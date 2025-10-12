# 🎖️ Roblox Askeri Kamp Discord Botu

Roblox askeri kampınızı yönetmek için Discord botu.

## 🚀 Kurulum

### 1. Gerekli API Anahtarları

Botun çalışması için aşağıdaki ortam değişkenlerini ayarlamanız gerekiyor:

- **DISCORD_TOKEN**: Discord Developer Portal'dan bot tokenınız
- **DISCORD_CLIENT_ID**: Discord Application ID'niz  
- **ROBLOX_COOKIE**: Roblox .ROBLOSECURITY cookie değeri (grup yönetimi için)

### 2. Yapılandırma

`config.json` dosyasını düzenleyin:

```json
{
  "groupId": "ROBLOX_GRUP_ID",
  "gameId": "ROBLOX_OYUN_UNIVERSE_ID",
  "adminRoleId": "DISCORD_ADMIN_ROLE_ID",
  "minRankToManage": 200,
  "maxRankCanAssign": 250
}
```

- **groupId**: Roblox grup ID'niz
- **gameId**: Roblox oyun Universe ID'si (aktiflik sorgusu için)
- **adminRoleId**: Discord'da yasaklama komutlarını kullanabilecek rolün ID'si
- **minRankToManage**: Rütbe yönetimi yapabilmek için minimum Roblox rütbe seviyesi
- **maxRankCanAssign**: Yöneticilerin atayabileceği maksimum rütbe seviyesi

### 3. Discord Bot Yetkileri

Discord Developer Portal'da botunuza şu yetkileri verin:

**Privileged Gateway Intents:**
- ✅ Server Members Intent
- ✅ Message Content Intent

**Bot Permissions:**
- ✅ Read Messages/View Channels
- ✅ Send Messages
- ✅ Embed Links
- ✅ Ban Members
- ✅ Use Slash Commands

## 📋 Komutlar

### Hesap Bağlama Komutu

- `/roblox-bağla <roblox_nick>` - Discord hesabınızı Roblox hesabınıza bağlar
  - **Güvenlik:** Bot size benzersiz bir doğrulama kodu verecek
  - Bu kodu Roblox profil açıklamanıza ekleyip komutu tekrar çalıştırmanız gerekir
  - Kod 10 dakika süreyle geçerlidir ve tek kullanımlıktır
  - Bot size adım adım talimatları gösterecektir

### Rütbe Komutları (Roblox Rütbe Bazlı Yetki Sistemi)

- `/rütbe-sorgu <roblox_nick>` - Kullanıcının Roblox grubundaki rütbesini gösterir
- `/rütbe-değiştir <roblox_nick> <rütbe>` - Kullanıcının rütbesini değiştirir (Hesap bağlama ve rütbe yetkisi gerekir)
- `/rütbe-terfi <roblox_nick>` - Kullanıcıya 1 seviye terfi verir (Hesap bağlama ve rütbe yetkisi gerekir)
- `/rütbe-tenzil <roblox_nick>` - Kullanıcıya 1 seviye tenzil verir (Hesap bağlama ve rütbe yetkisi gerekir)

### Discord Yasaklama Komutları (Discord User ID ile)

- `/tam-yasakla <kullanici_id>` - Discord kullanıcısını sunucudan yasaklar (Admin)
- `/tam-yasak-kaldır <kullanici_id>` - Discord kullanıcısının yasağını kaldırır (Admin)

### Oyun Aktiflik Komutu

- `/aktiflik-sorgu` - Grup oyununun anlık aktifliğini gösterir

## 🔧 Kullanım Notları

### Rütbe Yönetimi Sistemi
- **Hesap Bağlama (Zorunlu):** 
  - Rütbe verme komutlarını kullanmadan önce `/roblox-bağla` komutu ile Discord hesabınızı Roblox hesabınıza bağlamalısınız
  - Hesap doğrulaması için benzersiz bir doğrulama kodu alacaksınız
  - Bu kodu Roblox profil açıklamanıza ekleyip komutu tekrar çalıştırmalısınız
  - Her doğrulama kodu tek kullanımlık ve 10 dakika süreyle geçerlidir
  - Bu sayede kimse başkasının hesabını kullanarak yetki alamaz
  
- **Yetki Sistemi:**
  - Rütbe verme komutları **Roblox rütbe seviyesine** göre çalışır
  - Rütbe vermek için kullanıcının Roblox grubunda `minRankToManage` değerinden yüksek rütbesi olmalıdır
  - Yöneticiler sadece kendi rütbelerinden düşük veya `maxRankCanAssign` değerinden düşük rütbeleri verebilir
  - Sistem, Discord kullanıcı ID'nizi kullanarak bağlı Roblox hesabınızdan yetki kontrolü yapar

### Diğer Notlar
- Discord yasaklama komutları için `adminRoleId` rolüne sahip olmanız gerekir
- Roblox cookie'si, grup yönetim yetkisine sahip bir hesaptan alınmalıdır
- Discord User ID'sini almak için: Kullanıcıya sağ tıklayın → "ID'yi Kopyala" (Geliştirici Modu aktif olmalı)

## 📝 API Entegrasyonları

- **Discord.js**: Discord bot fonksiyonları
- **Roblox API**: Grup ve kullanıcı yönetimi
- **Roblox Games API**: Oyun aktiflik verileri
