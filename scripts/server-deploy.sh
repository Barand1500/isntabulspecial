#!/usr/bin/env bash
# CloudPanel site-user deployment. No sudo, Docker or system service required.
set -Eeuo pipefail
umask 077

fail() {
	printf '\nHATA: %s\n' "$*" >&2
	exit 1
}
log() { printf '\n[İstanbul Spesial] %s\n' "$*"; }

REPO_DIR="${REPO_DIR:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)}"
SITE_DIR="${SITE_DIR:-$HOME/htdocs/istanbulspesial.com.tr}"
RUNTIME_DIR="${RUNTIME_DIR:-$HOME/apps/istanbul-spesial-runtime}"
SHARED_DIR="${SHARED_DIR:-$HOME/apps/istanbul-spesial-shared}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-3015}"
APP_NAME="${APP_NAME:-istanbul-spesial}"
APP_ORIGIN="${APP_ORIGIN:-https://istanbulspesial.com.tr}"
ENV_FILE="${ENV_FILE:-$SHARED_DIR/.env}"
MODE="${1:-deploy}"
[[ "$MODE" == deploy || "$MODE" == --rollback ]] || fail 'Kullanım: server-deploy.sh [--rollback]'
[[ "$PORT" =~ ^[0-9]+$ ]] && ((PORT > 1024 && PORT < 65536)) || fail 'Port 1025–65535 aralığında olmalıdır.'
[[ "$APP_NAME" =~ ^[a-zA-Z0-9_-]+$ ]] || fail 'Geçersiz uygulama adı.'
[[ "$SHARED_DIR" == /* && "$SITE_DIR" == /* && "$RUNTIME_DIR" == /* && "$REPO_DIR" == /* ]] || fail 'Dizin yolları mutlak olmalıdır.'
[[ "$(id -u)" != 0 ]] || fail 'Bu komutu root yerine CloudPanel site kullanıcısıyla çalıştırın.'

# Run a private snapshot: git pull must not replace a script while Bash is reading it.
if [[ "${SPESIAL_DEPLOY_SNAPSHOT:-0}" != 1 ]]; then
	mkdir -p -- "$SHARED_DIR"
	SNAPSHOT="$SHARED_DIR/.deploy-$$.sh"
	HELPER_SNAPSHOT="$SHARED_DIR/.deploy-helper-$$.mjs"
	cp -- "${BASH_SOURCE[0]}" "$SNAPSHOT"
	cp -- "$REPO_DIR/scripts/deploy-helper.mjs" "$HELPER_SNAPSHOT"
	export REPO_DIR SITE_DIR RUNTIME_DIR SHARED_DIR BRANCH PORT APP_NAME APP_ORIGIN ENV_FILE
	export SPESIAL_DEPLOY_SNAPSHOT=1 SPESIAL_SNAPSHOT_FILE="$SNAPSHOT" SPESIAL_HELPER_FILE="$HELPER_SNAPSHOT"
	exec bash "$SNAPSHOT" "$MODE"
fi
HELPER="$SPESIAL_HELPER_FILE"
cleanup() {
	[[ "${SPESIAL_SNAPSHOT_FILE:-}" == "$SHARED_DIR"/.deploy-*.sh ]] && rm -f -- "$SPESIAL_SNAPSHOT_FILE"
	[[ "${SPESIAL_HELPER_FILE:-}" == "$SHARED_DIR"/.deploy-helper-*.mjs ]] && rm -f -- "$SPESIAL_HELPER_FILE"
	return 0
}
trap cleanup EXIT

node_ok() {
	command -v node >/dev/null 2>&1 && node --input-type=module -e "import * as s from 'node:sqlite'; if(typeof s.backup!=='function') process.exit(1)" >/dev/null 2>&1
}
if ! node_ok; then
	NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
	[[ -s "$NVM_SCRIPT" ]] || fail 'CloudPanel’de Node 22 LTS seçin ve SSH oturumunu yeniden açın. Node 22.16+ gereklidir.'
	set +u
	# shellcheck source=/dev/null
	source "$NVM_SCRIPT" --no-use
	nvm use 22 || true
	if ! node_ok; then nvm install 22; fi
	set -u
fi
node_ok || fail 'Node.js 22.16+ ve node:sqlite backup desteği gerekiyor.'
NODE_BIN="$(command -v node)"
export PATH="$(dirname -- "$NODE_BIN"):$PATH"
for command in git npm flock; do command -v "$command" >/dev/null || fail "$command bu kullanıcıda bulunamadı."; done
"$NODE_BIN" "$HELPER" paths "$REPO_DIR" "$SITE_DIR" "$RUNTIME_DIR" "$SHARED_DIR"
exec 9>"$SHARED_DIR/deploy.lock"
flock -n 9 || fail 'Başka bir deploy halen çalışıyor.'
mkdir -p -- "$RUNTIME_DIR/releases" "$SHARED_DIR/data" "$SHARED_DIR/backups" "$SHARED_DIR/logs" "$SHARED_DIR/bin" "$SHARED_DIR/tools"

TOOLS_DIR="$SHARED_DIR/tools/pm2"
export PM2_HOME="$SHARED_DIR/pm2"
PM2_BIN="$TOOLS_DIR/node_modules/.bin/pm2"
if [[ ! -x "$PM2_BIN" ]]; then
	log 'PM2 yalnızca bu site kullanıcısına ait özel dizine kuruluyor.'
	npm install --prefix "$TOOLS_DIR" --omit=dev --no-audit --no-fund 'pm2@6'
fi
run_pm2() { "$PM2_BIN" "$@"; }
"$NODE_BIN" "$HELPER" init-env "$ENV_FILE" "$SHARED_DIR" "$PORT" "$APP_ORIGIN"
DB_PATH="$("$NODE_BIN" "$HELPER" config-db "$ENV_FILE" "$SHARED_DIR" "$SITE_DIR" "$REPO_DIR")"
APP_ORIGIN="$("$NODE_BIN" "$HELPER" config-origin "$ENV_FILE" "$SHARED_DIR" "$SITE_DIR" "$REPO_DIR")"
PREVIOUS="$("$NODE_BIN" "$HELPER" current "$RUNTIME_DIR")"
CHANGING=0
COMMITTED=0
ECOSYSTEM="$SHARED_DIR/ecosystem.config.cjs"

start_release() {
	local target="$1" revision="$2"
	"$NODE_BIN" "$HELPER" pm2 "$target" "$ENV_FILE" "$APP_NAME" "$PORT" "$NODE_BIN" "$SHARED_DIR/logs" "$ECOSYSTEM" "$DB_PATH" "$revision"
	if run_pm2 describe "$APP_NAME" >/dev/null 2>&1; then run_pm2 delete "$APP_NAME"; fi
	run_pm2 start "$ECOSYSTEM" --only "$APP_NAME"
}
on_error() {
	local code="$1"
	trap - ERR
	set +e
	if ((CHANGING == 1 && COMMITTED == 0)); then
		if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
			log 'Yeni sürüm başarısız. Önceki uygulama sürümü yeniden başlatılıyor.'
			local revision
			revision="$("$NODE_BIN" "$HELPER" revision "$PREVIOUS")"
			start_release "$PREVIOUS" "$revision"
			"$NODE_BIN" "$HELPER" health "$PORT" "$revision"
			run_pm2 save
		else
			run_pm2 delete "$APP_NAME" >/dev/null 2>&1
		fi
	fi
	printf '\nDeploy tamamlanamadı. .env ve veritabanı silinmedi. Log: %s\n' "$SHARED_DIR/logs/error.log" >&2
	exit "$code"
}
trap 'on_error $?' ERR

if [[ "$MODE" == --rollback ]]; then
	RELEASE="$("$NODE_BIN" "$HELPER" previous "$RUNTIME_DIR")"
	[[ -n "$RELEASE" && -d "$RELEASE/node_modules" ]] || fail 'Geri dönülebilecek önceki bir sürüm yok.'
	REVISION="$("$NODE_BIN" "$HELPER" revision "$RELEASE")"
	log "Önceki kod sürümüne dönülüyor: ${REVISION:0:12} (veritabanı geri alınmaz)."
else
	log "Git güncelleniyor: $BRANCH"
	git -C "$REPO_DIR" check-ref-format --branch "$BRANCH" >/dev/null
	[[ "$(git -C "$REPO_DIR" rev-parse --show-toplevel)" == "$REPO_DIR" ]] || fail 'REPO_DIR depo kökü değil.'
	git -C "$REPO_DIR" diff --quiet && git -C "$REPO_DIR" diff --cached --quiet || fail 'Depoda yerel değişiklik var; otomatik olarak silinmedi.'
	git -C "$REPO_DIR" fetch origin "$BRANCH:refs/remotes/origin/$BRANCH"
	if [[ "$(git -C "$REPO_DIR" branch --show-current)" != "$BRANCH" ]]; then
		if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/$BRANCH"; then git -C "$REPO_DIR" switch "$BRANCH"; else git -C "$REPO_DIR" switch --track -c "$BRANCH" "origin/$BRANCH"; fi
	fi
	git -C "$REPO_DIR" merge --ff-only "origin/$BRANCH"
	REVISION="$(git -C "$REPO_DIR" rev-parse HEAD)"
	log 'Temiz bağımlılık kurulumu, güvenlik testleri ve üretim derlemesi.'
	(cd -- "$REPO_DIR" && npm ci --include=dev --no-audit --no-fund && npm test && npm run build)
	RELEASE="$RUNTIME_DIR/releases/$(date +%Y%m%dT%H%M%S)-${REVISION:0:12}-$$"
	"$NODE_BIN" "$HELPER" stage "$REPO_DIR" "$RELEASE" "$REVISION"
	(cd -- "$RELEASE" && npm ci --omit=dev --no-audit --no-fund)
fi

BACKUP="$SHARED_DIR/backups/$(date +%Y%m%dT%H%M%S)-$$.sqlite"
"$NODE_BIN" "$HELPER" backup "$DB_PATH" "$BACKUP"
OLD_REVISION=""
[[ -n "$PREVIOUS" ]] && OLD_REVISION="$("$NODE_BIN" "$HELPER" revision "$PREVIOUS")"
OWNER_PID="$(run_pm2 pid "$APP_NAME" 2>/dev/null | tail -n 1 || true)"
OWNED=0
[[ "$OWNER_PID" =~ ^[1-9][0-9]*$ ]] && OWNED=1
"$NODE_BIN" "$HELPER" port "$PORT" "$OLD_REVISION" "$OWNED"
CHANGING=1
start_release "$RELEASE" "$REVISION"
"$NODE_BIN" "$HELPER" health "$PORT" "$REVISION"
# API has passed health checks. Copy public files only; index.html is written last.
"$NODE_BIN" "$HELPER" publish "$RELEASE/dist" "$SITE_DIR"
"$NODE_BIN" "$HELPER" activate "$RUNTIME_DIR" "$RELEASE"
COMMITTED=1
run_pm2 save
"$NODE_BIN" "$HELPER" recovery "$SHARED_DIR/bin/restart.sh" "$NODE_BIN" "$TOOLS_DIR/node_modules/pm2/bin/pm2" "$PM2_HOME" "$(dirname -- "$NODE_BIN")"

if [[ "${INSTALL_REBOOT_HOOK:-1}" == 1 ]] && command -v crontab >/dev/null 2>&1; then
	CRON_TEMP="$SHARED_DIR/.cron-$$"
	crontab -l >"$CRON_TEMP" 2>/dev/null || true
	if ! grep -Fq '# istanbul-spesial-reboot' "$CRON_TEMP"; then
		printf '\n@reboot "%s" >> "%s" 2>&1 # istanbul-spesial-reboot\n' "$SHARED_DIR/bin/restart.sh" "$SHARED_DIR/logs/boot.log" >>"$CRON_TEMP"
		if crontab "$CRON_TEMP"; then log 'Root istemeyen kullanıcı @reboot kaydı eklendi.'; else log 'Cron yetkisi yok. Yeniden açılış için deploy/README.md içindeki kurtarma komutunu kullanın.'; fi
	fi
	rm -f -- "$CRON_TEMP"
fi
"$NODE_BIN" "$HELPER" prune "$RUNTIME_DIR" || log 'Eski sürüm temizliği atlandı; çalışan sürüm etkilenmedi.'
log "Yayın hazır: ${REVISION:0:12} | 127.0.0.1:$PORT"
printf 'Site: %s\nAdmin: %s/admin\nÖzel ayarlar: %s\n' "$APP_ORIGIN" "$APP_ORIGIN" "$ENV_FILE"
printf 'İlk kurulumda CloudPanel Vhost içine deploy/cloudpanel-api.conf bloğunu bir kez ekleyin.\n'
