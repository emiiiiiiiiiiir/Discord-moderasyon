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

### Rütbe Komutları (Roblox Rütbe Bazlı Yetki Sistemi)

- `/rütbe-sorgu <roblox_nick>` - Kullanıcının Roblox grubundaki rütbesini gösterir
- `/rütbe-değiştir <yonetici_roblox_nick> <roblox_nick> <rütbe>` - Kullanıcının rütbesini değiştirir (Rütbe yetkisi gerekir)
- `/rütbe-terfi <yonetici_roblox_nick> <roblox_nick>` - Kullanıcıya 1 seviye terfi verir (Rütbe yetkisi gerekir)
- `/rütbe-tenzil <yonetici_roblox_nick> <roblox_nick>` - Kullanıcıya 1 seviye tenzil verir (Rütbe yetkisi gerekir)

### Discord Yasaklama Komutları (Discord User ID ile)

- `/tam-yasakla <kullanici_id>` - Discord kullanıcısını sunucudan yasaklar (Admin)
- `/tam-yasak-kaldır <kullanici_id>` - Discord kullanıcısının yasağını kaldırır (Admin)

### Oyun Aktiflik Komutu

- `/aktiflik-sorgu` - Grup oyununun anlık aktifliğini gösterir

## 🔧 Kullanım Notları

### Rütbe Yönetimi Sistemi
- Rütbe verme komutları artık **Roblox rütbe seviyesine** göre çalışır
- Rütbe vermek için kullanıcının Roblox grubunda `minRankToManage` değerinden yüksek rütbesi olmalıdır
- Yöneticiler sadece kendi rütbelerinden düşük veya `maxRankCanAssign` değerinden düşük rütbeleri verebilir
- Her rütbe komutu için kendi Roblox kullanıcı adınızı girmeniz gerekir (yetki kontrolü için)

### Diğer Notlar
- Discord yasaklama komutları için `adminRoleId` rolüne sahip olmanız gerekir
- Roblox cookie'si, grup yönetim yetkisine sahip bir hesaptan alınmalıdır
- Discord User ID'sini almak için: Kullanıcıya sağ tıklayın → "ID'yi Kopyala" (Geliştirici Modu aktif olmalı)

## 📝 API Entegrasyonları

- **Discord.js**: Discord bot fonksiyonları
- **Roblox API**: Grup ve kullanıcı yönetimi
- **Roblox Games API**: Oyun aktiflik verileri
