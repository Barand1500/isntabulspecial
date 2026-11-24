# İstanbul Spesial — CloudPanel Git deploy

Bu düzen **CloudPanel site kullanıcısıyla** çalışır. `sudo`, root, Docker, sistem servisi veya MySQL kurulumu gerektirmez. CloudPanel Node sürümü **22 LTS**, App Port **3015** olmalıdır. Node 22.16+ gerekir; kullanıcının mevcut NVM kurulumu varsa betik uygun Node 22 sürümünü seçer.

| Alan | Değer |
|---|---|
| Git | `https://github.com/Barand1500/isntabulspecial.git` |
| Site | `$HOME/htdocs/istanbulspesial.com.tr` |
| Kaynak clone | `$HOME/apps/istanbul-spesial` |
| Çalışan sürümler | `$HOME/apps/istanbul-spesial-runtime/releases` |
| Özel ayarlar, veritabanı, yedek ve loglar | `$HOME/apps/istanbul-spesial-shared` |
| API | `127.0.0.1:3015` |

## İlk kurulum — SSH, bir kez

CloudPanel site kullanıcısıyla bağlanın:

```bash
ssh SITE_USER@SUNUCU_IP
mkdir -p $HOME/apps
cd $HOME/apps
git clone https://github.com/Barand1500/isntabulspecial.git istanbul-spesial
cd istanbul-spesial
chmod +x scripts/server-deploy.sh
./scripts/server-deploy.sh
```

Repo zaten clone edildiyse yeniden clone etmek yerine o dizinde `git pull --ff-only` çalıştırın. Private depoda kendi SSH anahtarınızı veya GitHub erişiminizi kullanın; token’ı script içine yazmayın.

İlk çalıştırmada özel `.env` oluşturulur ve rastgele güçlü bir yönetici parolası üretilir. Var olan `.env` asla değiştirilmez. İlk parolayı sadece kendi SSH terminalinizde görüntüleyin:

```bash
grep '^ADMIN_PASSWORD=' $HOME/apps/istanbul-spesial-shared/.env
```

Hesap `admin@guzelteknoloji.com` adresidir. Yerel geliştirme parolası `123456` canlıya taşınmaz. İlk kurulumdan önce kendi ayarlarınızı hazırlamak isterseniz aynı özel konumda `.env` oluşturabilirsiniz. Parola veritabanına hash olarak kaydedilir; sonraki deploylarda `.env` değiştirerek mevcut hesabın parolası değiştirilmez.

## CloudPanel Vhost — bir kez

Ekran görüntünüzde Vhost statik dosya sunuyor. CloudPanel → **Vhost** içinde, `server_name istanbulspesial.com.tr ...` yazan **ikinci / ana server bloğuna** [cloudpanel-api.conf](cloudpanel-api.conf) içeriğini ekleyip kaydedin:

```nginx
location ^~ /api/ {
    proxy_pass http://127.0.0.1:3015;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 5s;
    proxy_read_timeout 30s;
    proxy_send_timeout 30s;
    add_header Cache-Control "no-store" always;
}
```

Mevcut SSL, `{{root}}`, `.well-known`, `/assets/`, `/images/`, `/logos/` ve `location /` kurallarını koruyun. Aynı `/api/` bloğu zaten varsa yenisini eklemek yerine mevcut bloğu güncelleyin. Ana sayfa ve `/admin` için mevcut SPA kuralı `try_files $uri $uri/ /index.html;` olmalıdır. `index.html` için uzun süreli cache tanımlamayın.

CloudPanel Vhost kaydı panel üzerinden yapılır; SSH kullanıcısının Nginx dosyalarına veya root yetkisine ihtiyacı yoktur. Script Vhost’u kendisi değiştirmez.

Kontrol:

```bash
curl -fsS http://127.0.0.1:3015/api/health
curl -fsS https://istanbulspesial.com.tr/api/health
```

İkisi de `ok: true` dönmelidir. Yalnızca ilk kontrol çalışıyorsa Vhost proxy bloğunu kontrol edin. Google girişi için özel `.env` dosyasına `GOOGLE_CLIENT_ID` ekleyip tekrar deploy çalıştırın.

## Her güncellemede — tek komut

Önce bilgisayardan güncel kodu `main` dalına gönderin, ardından SSH üzerinde:

```bash
$HOME/apps/istanbul-spesial/scripts/server-deploy.sh
```

Script şunları yapar:

1. Deploy kilidi alır, yerel değişiklikleri silmeden Git’i `main` dalına fast-forward günceller.
2. `npm ci`, admin güvenlik testleri ve üretim derlemesini çalıştırır.
3. Ayrı sürüm dizinine yalnızca `dist`, çalışma zamanı `server/*.mjs`, `package.json` ve lock dosyasını hazırlar; sadece üretim bağımlılıklarını kurar.
4. Çalışan SQLite verisinin WAL kayıtlarını da içeren tutarlı yedeğini alır.
5. Kullanıcıya özel PM2 ile API’yi yalnızca `127.0.0.1:3015` üzerinde başlatır; commit kimliğini sağlık yanıtından doğrular.
6. Kontrol başarılıysa statik dosyaları siteye kopyalar; `index.html` en son ve atomik yazılır.
7. PM2 durumunu kaydeder. Cron yetkisi varsa yalnızca kendi kullanıcı `@reboot` kaydını ekler. Son sürümler ve geri dönüş sürümü korunur.

`.env`, veritabanı, `uploads/`, `.well-known/` ve mevcut ekstra site dosyaları silinmez. Repo, kaynak kodları, testler, Git klasörü veya sırlar web köküne kopyalanmaz. Eski hash’li ön yüz dosyaları, açık ziyaretçi sekmelerini bozmamak için web kökünden otomatik silinmez.

## İsteğe bağlı kısa komut

Bir kez:

```bash
echo 'alias spesial-deploy="$HOME/apps/istanbul-spesial/scripts/server-deploy.sh"' >> ~/.bashrc
source ~/.bashrc
```

Sonra:

```bash
spesial-deploy
```

## Hata ve geri dönüş

Derleme başarısızsa çalışan sürüme dokunulmaz. Yeni API sağlık kontrolünden geçmezse önceki API sürümü yeniden başlatılır; ön yüz henüz değiştirilmemiş olur. Hata logu:

```bash
tail -n 80 $HOME/apps/istanbul-spesial-shared/logs/error.log
```

Son başarılı kod sürümüne elle dönmek için:

```bash
$HOME/apps/istanbul-spesial/scripts/server-deploy.sh --rollback
```

Bu işlem **veritabanını geri almaz**. Veritabanı yedekleri `shared/backups/` altındadır. Script seed/reset çalıştırmaz; CloudPanel MySQL veritabanına dokunmaz. Gelecekte yıkıcı bir şema değişikliği yapılırsa kod geri dönüşü ayrıca değerlendirilmelidir.

## Sunucu yeniden açılırsa

Script root isteyen `pm2 startup` çalıştırmaz. Kullanıcı cron izni varsa `@reboot` otomatik kurulur. İzin yoksa script durumu bildirir; CloudPanel Cron Jobs veya sunucu yöneticisi üzerinden aynı kurtarma komutu yeniden açılışta çalıştırılmalıdır. Elle kurtarma:

```bash
$HOME/apps/istanbul-spesial-shared/bin/restart.sh
```

Yalnızca `pm2 save` kullanmak, tek başına reboot sonrasında otomatik başlangıç sağlamaz. Diğer projelerin PM2 süreçleri bu uygulamadan ayrı tutulur.

## Farklı dal, yol veya port

```bash
BRANCH=develop $HOME/apps/istanbul-spesial/scripts/server-deploy.sh
PORT=3016 $HOME/apps/istanbul-spesial/scripts/server-deploy.sh
REPO_DIR=/tam/kaynak SITE_DIR=/tam/site RUNTIME_DIR=/tam/runtime SHARED_DIR=/tam/shared /tam/kaynak/scripts/server-deploy.sh
```

Port değişirse CloudPanel App Port ve Vhost proxy portunu da aynı değere getirin. Kullanılmakta olan yabancı bir portu script zorla kapatmaz. Tekrarlı cron kurulumunu kapatmak için `INSTALL_REBOOT_HOOK=0` verilebilir.

Doğrulama: `npm run test:deploy`, `npm test`, `npm run build`. Script Bash sözdizimi doğrulamasından geçirilmiştir. Canlı sunucuda çalıştırılması SSH üzerinde yapılır.

Teknik kaynaklar: [CloudPanel PM2 dağıtımı](https://www.cloudpanel.io/docs/v2/nodejs/deployment/pm2/), [PM2 başlangıç ve kalıcılık](https://pm2.keymetrics.io/docs/usage/startup/), [Node SQLite online backup](https://nodejs.org/download/release/v22.21.0/docs/api/sqlite.html#sqlitebackupsourceDb-destination-options).
