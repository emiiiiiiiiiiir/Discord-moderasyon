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
  "adminRoleId": "DISCORD_ADMIN_ROLE_ID"
}
```

- **groupId**: Roblox grup ID'niz
- **gameId**: Roblox oyun Universe ID'si (aktiflik sorgusu için)
- **adminRoleId**: Discord'da admin komutlarını kullanabilecek rolün ID'si

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

### Rütbe Komutları (Roblox Nick ile)

- `/rütbe-sorgu <roblox_nick>` - Kullanıcının Roblox grubundaki rütbesini gösterir
- `/rütbe-değiştir <roblox_nick> <rütbe>` - Kullanıcının rütbesini değiştirir (Admin)
- `/rütbe-terfi <roblox_nick>` - Kullanıcıya 1 seviye terfi verir (Admin)
- `/rütbe-tenzil <roblox_nick>` - Kullanıcıya 1 seviye tenzil verir (Admin)

### Discord Yasaklama Komutları (Discord User ID ile)

- `/tam-yasakla <kullanici_id>` - Discord kullanıcısını sunucudan yasaklar (Admin)
- `/tam-yasak-kaldır <kullanici_id>` - Discord kullanıcısının yasağını kaldırır (Admin)

### Oyun Aktiflik Komutu

- `/aktiflik-sorgu` - Grup oyununun anlık aktifliğini gösterir

## 🔧 Kullanım Notları

- Tüm admin komutları için `adminRoleId` rolüne sahip olmanız gerekir
- Roblox cookie'si, grup yönetim yetkisine sahip bir hesaptan alınmalıdır
- Discord User ID'sini almak için: Kullanıcıya sağ tıklayın → "ID'yi Kopyala" (Geliştirici Modu aktif olmalı)

## 📝 API Entegrasyonları

- **Discord.js**: Discord bot fonksiyonları
- **Roblox API**: Grup ve kullanıcı yönetimi
- **Roblox Games API**: Oyun aktiflik verileri
