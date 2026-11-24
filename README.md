# İstanbul Spesial

React + TypeScript + Vite frontend, Node.js/Express yönetim API’si ve SQLite veritabanı. Ana site `/`, yönetim girişi `/admin`, cihaz listesi `/admin/devices` adresindedir.

## Yerel geliştirme

Node.js 22.13 veya üzeri:

```bash
npm ci
npm run dev
```

`http://localhost:5173` açılır. API aynı Vite sürecinde çalışır; ayrıca sunucu başlatmak gerekmez. Yerel ilk hesap: `admin@guzelteknoloji.com` / `123456`. Bu parola yalnızca geliştirme içindir. Yerel ayarları değiştirmek için `.env.example` dosyasını `.env` olarak kopyalayın.

## Cihaz ekleme ve QR girişi

1. Yönetici hesabıyla giriş yapın, **Cihazlar → Cihaz ekle** seçin.
2. Yeni cihazda karekodu okutun. Cihaz adını kontrol edin veya değiştirin.
3. Yönetim panelinde görünen cihaz/IP bilgilerini kontrol edip **Cihazı ekle** düğmesiyle onaylayın.
4. Sonraki girişlerde giriş ekranındaki karekodu bu kayıtlı cihazla okutun ve giriş isteğini onaylayın. Telefonda açık bir yönetici oturumu gerekmez.

Cihaz ekleme kodu 3 dakika, giriş kodu 2 dakika geçerlidir. Kodlar tek kullanımlıdır. Cihazın QR giriş yetkisi 90 gündür; cihazı kaldırmak bu yetkiyi ve oturumlarını iptal eder. Çıkış yapmak QR yetkisini kaldırmaz.

Aynı tarayıcıdaki girişler HttpOnly cihaz çereziyle tek kayıtta toplanır; IP veya tarayıcı adı kimlik olarak kullanılmaz. Gizli sekme, farklı tarayıcı veya çerezlerin silinmesi yeni kimlik oluşturabilir. Tarayıcılar telefonun kişisel adını/seri numarasını genellikle paylaşmaz; model veya platform algılanabildiği ölçüde gösterilir, ad yönetim panelinden düzenlenebilir.

Telefonla gerçek denemede `localhost` telefondaki bilgisayara erişmez. `APP_ORIGIN` değerini her iki cihazın erişebildiği alan adına veya yerel ağ adresine ayarlayıp siteyi o adresten açın. Üretimde HTTPS kullanılır.

## CloudPanel — tek komutla Git deploy

CloudPanel site kullanıcısı ve App Port `3015` için root gerektirmeyen hazır betik:

```bash
$HOME/apps/istanbul-spesial/scripts/server-deploy.sh
```

İlk kurulum, Vhost’a bir kez eklenecek API proxy bloğu, parola, veri koruma, reboot ve geri dönüş komutları: **[CloudPanel deploy kılavuzu](deploy/README.md)**. Sunucuya yalnızca derlenmiş ön yüz ve gerekli API çalışma dosyaları yayınlanır.

## Üretim dağıtımı

Admin API bulunduğu için yalnızca `dist/` yüklemek artık yeterli değildir. Node sunucusu veya Docker çalıştırılmalıdır. HTTPS’i sunucunun ters vekili üzerinde sonlandırın.

Sunucuda Git’e gönderilmeyen bir `.env` dosyası hazırlayın:

```dotenv
APP_ORIGIN=https://istanbulspesial.com.tr
ADMIN_EMAIL=admin@guzelteknoloji.com
ADMIN_PASSWORD=BURAYA-EN-AZ-12-KARAKTER-UZUNLUGUNDA-BENZERSIZ-PAROLA
TRUST_PROXY=1
```

`TRUST_PROXY=1` yalnızca uygulama tam olarak bir güvenilir ters vekilin arkasındaysa kullanılmalıdır. İlk üretim kurulumu 12 karakterden kısa parolayı kabul etmez. Yönetici parolası veritabanına hash olarak yazılır; `.env` parolasını sonradan değiştirmek mevcut hesabın parolasını otomatik değiştirmez.

```bash
docker build -t istanbul-spesial .
docker run -d --name istanbul-spesial --restart unless-stopped \
  --env-file .env -p 127.0.0.1:8080:3001 \
  -v istanbul-spesial-data:/app/data istanbul-spesial
```

Ters vekili `127.0.0.1:8080` adresine yönlendirin. `nginx.conf` başlangıç örneğidir; HTTPS sertifikası mevcut sunucu yapılandırmasına eklenmelidir. Veritabanı `/app/data` kalıcı hacminde tutulur; yedekleyin. SQLite aktifken WAL dosyalarını dikkate alan bir yedekleme yöntemi kullanın.

Docker olmadan: `npm ci`, `npm run build`, ardından üretim ortam değişkenleriyle `NODE_ENV=production npm start`. Sağlık kontrolü: `/api/health`.

## Google girişi

Google Cloud’da bir web istemcisi oluşturun; yetkili JavaScript kaynağına site adresini ekleyin. `GOOGLE_CLIENT_ID` değerini sunucu `.env` dosyasına yazın. Token sunucuda doğrulanır; yalnızca yapılandırılmış yönetici e-postasının doğrulanmış Google hesabına izin verilir. İstemci kimliği yoksa Google düğmesi durumu açıklar ve giriş yaptırmaz. Kayıt olma ekranı yoktur.

## Güvenlik ve test

Parola scrypt ile hash’lenir. Oturum ve cihaz anahtarlarının yalnızca hash’leri saklanır; çerezler HttpOnly ve SameSite=Strict, HTTPS üzerinde Secure özelliğindedir. Oturumlar en fazla 8 saattir; 30 dakika API etkinliği yoksa sona erer. Yazma isteklerinde Origin denetlenir ve hatalı giriş denemeleri sınırlandırılır. Veritabanı, `.env`, yerel araçlar ve test ekran görüntüleri Git dışında kalır.

```bash
npm test
npm run build
```

Testler geçici bellek veritabanında aynı tarayıcıdan 30 girişte tek kayıt, cihaz ekleme/yeniden adlandırma, QR onayı, tek kullanımlılık, iptal, CSRF ve giriş sınırını kontrol eder.

## İçerik

Ana sayfa `src/App.tsx`, iletişim `src/components/Contact.tsx`, örnek marka listesi `src/data/partners.ts`, yönetim arayüzü `src/admin`, giriş bileşeni `src/components/ui/auth-switch.tsx` içindedir. Örnek marka logoları gerçek iş ortaklığı belirtmez.

Kaynak bileşenler: [React Bits](https://reactbits.dev/); marka SVG’leri: [Simple Icons](https://simpleicons.org/). Google Fonts için internet bağlantısı kullanılır. Hareket azaltma ve WebGL bulunmaması durumları desteklenir.
