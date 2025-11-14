const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');
const robloxAPI = require('./src/roblox');
const fs = require('fs');
const axios = require('axios');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans
  ]
});

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;

const ACCOUNT_LINKS_FILE = './account_links.json';
const PENDING_VERIFICATIONS_FILE = './pending_verifications.json';

function validateEnvironmentVariables() {
  const requiredVars = [
    { name: 'DISCORD_TOKEN', value: DISCORD_TOKEN },
    { name: 'DISCORD_CLIENT_ID', value: DISCORD_CLIENT_ID },
    { name: 'ROBLOX_COOKIE', value: ROBLOX_COOKIE }
  ];

  const missingVars = requiredVars.filter(v => !v.value);
  
  if (missingVars.length > 0) {
    console.error('HATA: Gerekli environment variable\'lar eksik:');
    missingVars.forEach(v => console.error(`  - ${v.name}`));
    console.error('\nLütfen Replit Secrets bölümünden bu değişkenleri ekleyin.');
    process.exit(1);
  }
  
  console.log('✓ Tüm environment variable\'lar mevcut');
}

function validateConfig() {
  const warnings = [];
  
  if (!config.groupId) {
    console.error('HATA: config.json içinde groupId tanımlanmamış!');
    process.exit(1);
  }
  
  if (!config.gameId) {
    warnings.push('gameId tanımlanmamış - /aktiflik-sorgu komutu çalışmayacak');
  }
  
  if (!config.adminRoleIds || !Array.isArray(config.adminRoleIds) || config.adminRoleIds.length === 0) {
    warnings.push('adminRoleIds tanımlanmamış veya boş - yasaklama komutları çalışmayacak');
  }
  
  if (config.branchGroups) {
    const placeholders = Object.entries(config.branchGroups)
      .filter(([_, id]) => id === 'GRUP_ID_BURAYA')
      .map(([branch]) => branch);
    
    if (placeholders.length > 0) {
      warnings.push(`Şu branş grupları için ID tanımlanmamış: ${placeholders.join(', ')}`);
    }
  }
  
  if (warnings.length > 0) {
    console.warn('\n⚠️  Konfigürasyon Uyarıları:');
    warnings.forEach(w => console.warn(`  - ${w}`));
    console.warn('');
  } else {
    console.log('✓ Konfigürasyon geçerli');
  }
}

function loadAccountLinks() {
  try {
    if (fs.existsSync(ACCOUNT_LINKS_FILE)) {
      const data = fs.readFileSync(ACCOUNT_LINKS_FILE, 'utf8');
      if (!data || data.trim() === '') {
        console.warn('Hesap bağlantıları dosyası boş, yeni dosya oluşturuluyor...');
        return {};
      }
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Hesap bağlantıları yüklenirken hata:', error.message);
    console.warn('Bozuk dosya yedekleniyor ve yeni dosya oluşturuluyor...');
    try {
      if (fs.existsSync(ACCOUNT_LINKS_FILE)) {
        fs.copyFileSync(ACCOUNT_LINKS_FILE, `${ACCOUNT_LINKS_FILE}.backup-${Date.now()}`);
      }
    } catch (backupError) {
      console.error('Yedekleme hatası:', backupError.message);
    }
  }
  return {};
}

function saveAccountLinks(links) {
  try {
    fs.writeFileSync(ACCOUNT_LINKS_FILE, JSON.stringify(links, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Hesap bağlantıları kaydedilirken hata:', error);
    return false;
  }
}

function getLinkedRobloxUsername(discordUserId) {
  const links = loadAccountLinks();
  return links[discordUserId] || null;
}

function loadPendingVerifications() {
  try {
    if (fs.existsSync(PENDING_VERIFICATIONS_FILE)) {
      const data = fs.readFileSync(PENDING_VERIFICATIONS_FILE, 'utf8');
      if (!data || data.trim() === '') {
        console.warn('Bekleyen doğrulamalar dosyası boş, yeni dosya oluşturuluyor...');
        return {};
      }
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Bekleyen doğrulamalar yüklenirken hata:', error.message);
    console.warn('Bozuk dosya yedekleniyor ve yeni dosya oluşturuluyor...');
    try {
      if (fs.existsSync(PENDING_VERIFICATIONS_FILE)) {
        fs.copyFileSync(PENDING_VERIFICATIONS_FILE, `${PENDING_VERIFICATIONS_FILE}.backup-${Date.now()}`);
      }
    } catch (backupError) {
      console.error('Yedekleme hatası:', backupError.message);
    }
  }
  return {};
}

function savePendingVerifications(verifications) {
  try {
    fs.writeFileSync(PENDING_VERIFICATIONS_FILE, JSON.stringify(verifications, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Bekleyen doğrulamalar kaydedilirken hata:', error);
    return false;
  }
}

function generateVerificationCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function sendRankChangeWebhook(data) {
  if (!config.webhookUrl || config.webhookUrl === 'WEBHOOK_URL_BURAYA') {
    return;
  }
  
  try {
    const embed = {
      title: data.type === 'change' ? '🔄 Rütbe Değişikliği' : 
             data.type === 'promotion' ? '⬆️ Terfi' : 
             data.type === 'demotion' ? '⬇️ Tenzil' : 
             '🔀 Branş Rütbe Değişikliği',
      color: data.type === 'promotion' ? 0x57F287 : 
             data.type === 'demotion' ? 0xED4245 : 
             0x5865F2,
      fields: [
        {
          name: '👤 Hedef Kullanıcı',
          value: data.targetUser,
          inline: true
        },
        {
          name: '👮 İşlemi Yapan',
          value: `${data.manager} (${data.managerRank})`,
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Rütbe Log Sistemi'
      }
    };
    
    if (data.oldRank) {
      embed.fields.push({
        name: '📊 Eski Rütbe',
        value: data.oldRank,
        inline: true
      });
    }
    
    embed.fields.push({
      name: '📊 Yeni Rütbe',
      value: data.newRank,
      inline: true
    });
    
    if (data.branch) {
      embed.fields.push({
        name: '🏢 Branş',
        value: data.branch,
        inline: true
      });
    }
    
    if (data.reason) {
      embed.fields.push({
        name: '📝 Sebep',
        value: data.reason,
        inline: false
      });
    }
    
    await axios.post(config.webhookUrl, {
      embeds: [embed]
    });
  } catch (error) {
    console.error('Webhook gönderim hatası:', error.message);
  }
}

function cleanExpiredVerifications() {
  const verifications = loadPendingVerifications();
  const now = Date.now();
  const EXPIRY_TIME = 10 * 60 * 1000; // 10 dakika
  
  let changed = false;
  for (const userId in verifications) {
    if (now - verifications[userId].timestamp > EXPIRY_TIME) {
      delete verifications[userId];
      changed = true;
    }
  }
  
  if (changed) {
    savePendingVerifications(verifications);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('rütbe-sorgu')
    .setDescription('Kullanıcının Roblox grubundaki rütbesini sorgular')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('rütbe-değiştir')
    .setDescription('Belirtilen rütbeyi kullanıcıya verir')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Rütbe verilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('rütbe')
        .setDescription('Verilecek rütbe adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('rütbe-terfi')
    .setDescription('Kullanıcıya 1x terfi verir')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Terfi edilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('rütbe-tenzil')
    .setDescription('Kullanıcıya 1x tenzil verir')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Tenzil edilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('tamyasak')
    .setDescription('Kullanıcıyı botun bulunduğu tüm sunuculardan yasaklar')
    .addStringOption(option =>
      option.setName('kullanici_id')
        .setDescription('Discord kullanıcı ID\'si')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('tamyasak-kaldır')
    .setDescription('Kullanıcının botun bulunduğu tüm sunuculardan yasağını kaldırır')
    .addStringOption(option =>
      option.setName('kullanici_id')
        .setDescription('Discord kullanıcı ID\'si')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('aktiflik-sorgu')
    .setDescription('Grup oyununun aktifliğini sorgular'),
  
  new SlashCommandBuilder()
    .setName('roblox-bağla')
    .setDescription('Discord hesabınızı Roblox hesabınıza bağlar')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Roblox kullanıcı adınız')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('roblox-değiştir')
    .setDescription('Bağlı Roblox hesabınızı değiştirir')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Yeni Roblox kullanıcı adınız')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('grup-listele')
    .setDescription('Kullanıcının bulunduğu tüm grupları ve rütbelerini listeler')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('branş-istek')
    .setDescription('Branş grup isteğini kabul veya reddeder')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Roblox kullanıcı adı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('branş')
        .setDescription('Branş grubu')
        .setRequired(true)
        .addChoices(
          { name: 'DKK', value: 'DKK' },
          { name: 'KKK', value: 'KKK' },
          { name: 'ÖKK', value: 'ÖKK' },
          { name: 'JGK', value: 'JGK' },
          { name: 'AS.İZ', value: 'AS.İZ' },
          { name: 'HKK', value: 'HKK' }
        )
    )
    .addStringOption(option =>
      option.setName('karar')
        .setDescription('Kabul veya Red')
        .setRequired(true)
        .addChoices(
          { name: 'Kabul', value: 'kabul' },
          { name: 'Red', value: 'red' }
        )
    )
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Kabul/Red sebebi')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('branş-rütbe-değiştir')
    .setDescription('Branş grubunda kullanıcının rütbesini değiştirir')
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Rütbe verilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('branş')
        .setDescription('Branş grubu')
        .setRequired(true)
        .addChoices(
          { name: 'DKK', value: 'DKK' },
          { name: 'KKK', value: 'KKK' },
          { name: 'ÖKK', value: 'ÖKK' },
          { name: 'JGK', value: 'JGK' },
          { name: 'AS.İZ', value: 'AS.İZ' },
          { name: 'HKK', value: 'HKK' }
        )
    )
    .addStringOption(option =>
      option.setName('rütbe')
        .setDescription('Verilecek rütbe adı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Rütbe değişikliği sebebi')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('duyuru')
    .setDescription('Botun bulunduğu tüm sunuculara duyuru yapar')
    .addStringOption(option =>
      option.setName('mesaj')
        .setDescription('Duyuru mesajı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('kanal_adi')
        .setDescription('Duyurunun gönderileceği kanal adı (örn: duyurular, genel)')
        .setRequired(true)
    )
].map(command => command.toJSON());

console.log('=== Discord Bot Başlatılıyor ===\n');

validateEnvironmentVariables();
validateConfig();

console.log('\n=== Bot Başlatılıyor ===\n');

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

client.on('clientReady', async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı`);
  console.log(`Grup ID: ${config.groupId}`);
  console.log(`Oyun ID: ${config.gameId}`);
  
  console.log('\nEski global komutlar siliniyor...');
  try {
    await rest.put(Routes.applicationCommands(DISCORD_CLIENT_ID), { body: [] });
    console.log('✓ Global komutlar temizlendi');
  } catch (error) {
    console.error('✗ Global komut temizleme hatası:', error.message);
  }
  
  console.log('\nSlash komutları kaydediliyor...');
  
  const guilds = client.guilds.cache;
  let successCount = 0;
  let failCount = 0;
  
  for (const [guildId, guild] of guilds) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(DISCORD_CLIENT_ID, guildId),
        { body: commands }
      );
      console.log(`✓ ${guild.name} sunucusuna komutlar kaydedildi`);
      successCount++;
    } catch (error) {
      console.error(`✗ ${guild.name} sunucusuna komut kaydı hatası:`, error.message);
      failCount++;
    }
  }
  
  console.log(`\n=== Komut Kaydı Tamamlandı ===`);
  console.log(`Başarılı: ${successCount} sunucu`);
  console.log(`Başarısız: ${failCount} sunucu`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'rütbe-sorgu':
        await handleRankQuery(interaction);
        break;
      case 'rütbe-değiştir':
        await handleRankChange(interaction);
        break;
      case 'rütbe-terfi':
        await handleRankPromotion(interaction);
        break;
      case 'rütbe-tenzil':
        await handleRankDemotion(interaction);
        break;
      case 'tamyasak':
        await handleBan(interaction);
        break;
      case 'tamyasak-kaldır':
        await handleUnban(interaction);
        break;
      case 'aktiflik-sorgu':
        await handleActivityQuery(interaction);
        break;
      case 'roblox-bağla':
        await handleRobloxLink(interaction);
        break;
      case 'roblox-değiştir':
        await handleRobloxChange(interaction);
        break;
      case 'grup-listele':
        await handleGroupList(interaction);
        break;
      case 'branş-istek':
        await handleBranchRequest(interaction);
        break;
      case 'branş-rütbe-değiştir':
        await handleBranchRankChange(interaction);
        break;
      case 'duyuru':
        await handleAnnouncement(interaction);
        break;
    }
  } catch (error) {
    console.error(`Komut hatası (${commandName}):`, error);
    
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply('HATA: Bir hata oluştu!');
      } else {
        await interaction.reply({ 
          content: 'HATA: Bir hata oluştu!', 
          flags: 64
        });
      }
    } catch (replyError) {
      console.error('Hata mesajı gönderilemedi:', replyError.message);
    }
  }
});

async function checkRankPermissions(discordUserId, targetRank) {
  const managerUsername = getLinkedRobloxUsername(discordUserId);
  if (!managerUsername) {
    return { 
      allowed: false, 
      message: 'HATA: Discord hesabınız bir Roblox hesabına bağlı değil! Önce `/roblox-bağla` komutunu kullanarak hesabınızı bağlayın.' 
    };
  }

  const managerId = await robloxAPI.getUserIdByUsername(managerUsername);
  if (!managerId) {
    return { 
      allowed: false, 
      message: 'HATA: Bağlı Roblox kullanıcısı bulunamadı! Hesap bağlantınızı kontrol edin.' 
    };
  }

  const managerRank = await robloxAPI.getUserRankInGroup(managerId, config.groupId);
  if (!managerRank) {
    return { 
      allowed: false, 
      message: 'HATA: Grupta olmayan kişiler rütbe veremez!' 
    };
  }

  // İzinli rütbe seviyelerini kontrol et
  if (config.allowedRanks && !config.allowedRanks.includes(managerRank.rank)) {
    return { 
      allowed: false, 
      message: `HATA: Sadece ${config.allowedRanks.join(', ')} seviye rütbeler rütbe işlemi yapabilir! (Sizin rütbeniz: ${managerRank.rank})` 
    };
  }

  const maxAllowedRank = Math.min(managerRank.rank, config.maxRankCanAssign);
  
  if (targetRank > maxAllowedRank) {
    return { 
      allowed: false, 
      message: `HATA: En fazla ${maxAllowedRank} seviye rütbe verebilirsiniz! (Hedef rütbe: ${targetRank})` 
    };
  }

  return { 
    allowed: true, 
    managerRank: managerRank,
    managerUsername: managerUsername,
    maxAllowedRank: maxAllowedRank 
  };
}

async function handleRankQuery(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  
  if (!userId) {
    return interaction.editReply('HATA: Kullanıcı bulunamadı!');
  }
  
  const userInfo = await robloxAPI.getUserInfo(userId);
  const rankInfo = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  
  if (!rankInfo) {
    return interaction.editReply('HATA: Kullanıcı grupta değil!');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Rütbe Sorgusu')
    .setDescription(`**${robloxNick}** kullanıcısının rütbe bilgileri`)
    .addFields(
      { name: 'Roblox Kullanıcı Adı', value: userInfo.name, inline: true },
      { name: 'Roblox ID', value: userId.toString(), inline: true },
      { name: 'Rütbe', value: rankInfo.name, inline: true },
      { name: 'Rütbe Seviyesi', value: rankInfo.rank.toString(), inline: true }
    )
    .setColor(0x5865F2)
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleRankChange(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const targetRankName = interaction.options.getString('rütbe');
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('HATA: Hedef kullanıcı bulunamadı!');
  }
  
  const currentRank = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  
  const roles = await robloxAPI.getGroupRoles(config.groupId);
  if (!roles) {
    return interaction.editReply('HATA: Grup rütbeleri alınamadı! Grup ID\'sini kontrol edin.');
  }
  
  const targetRole = roles.find(r => r.name.toLowerCase() === targetRankName.toLowerCase());
  
  if (!targetRole) {
    return interaction.editReply('HATA: Belirtilen rütbe bulunamadı!');
  }
  
  const permissionCheck = await checkRankPermissions(interaction.user.id, targetRole.rank);
  if (!permissionCheck.allowed) {
    return interaction.editReply(permissionCheck.message);
  }
  
  const result = await robloxAPI.setUserRole(userId, config.groupId, targetRole.id, ROBLOX_COOKIE);
  
  if (result) {
    await sendRankChangeWebhook({
      type: 'change',
      targetUser: robloxNick,
      manager: permissionCheck.managerUsername,
      managerRank: permissionCheck.managerRank.name,
      oldRank: currentRank ? `${currentRank.name} (${currentRank.rank})` : 'Bilinmiyor',
      newRank: `${targetRole.name} (${targetRole.rank})`
    });
    
    const embed = new EmbedBuilder()
      .setTitle('Rütbe Değiştirildi')
      .setDescription(`**${robloxNick}** kullanıcısının rütbesi başarıyla değiştirildi`)
      .addFields(
        { name: 'İlgili Kişi', value: `${permissionCheck.managerUsername} (${permissionCheck.managerRank.name})`, inline: false },
        { name: 'Yeni Rütbe', value: targetRole.name, inline: true },
        { name: 'Rütbe', value: targetRole.rank.toString(), inline: true }
      )
      .setColor(0x57F287)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('HATA: Rütbe değiştirilemedi! Cookie kontrolü yapın.');
  }
}

async function handleRankPromotion(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  
  if (!userId) {
    return interaction.editReply('HATA: Hedef kullanıcı bulunamadı!');
  }
  
  const currentRank = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  if (!currentRank) {
    return interaction.editReply('HATA: Kullanıcı grupta değil!');
  }
  
  const roles = await robloxAPI.getGroupRoles(config.groupId);
  if (!roles) {
    return interaction.editReply('HATA: Grup rütbeleri alınamadı! Grup ID\'sini kontrol edin.');
  }
  
  const sortedRoles = roles.sort((a, b) => a.rank - b.rank);
  const currentIndex = sortedRoles.findIndex(r => r.rank === currentRank.rank);
  
  if (currentIndex === sortedRoles.length - 1) {
    return interaction.editReply('HATA: Kullanıcı zaten en üst rütbede!');
  }
  
  const nextRole = sortedRoles[currentIndex + 1];
  
  const permissionCheck = await checkRankPermissions(interaction.user.id, nextRole.rank);
  if (!permissionCheck.allowed) {
    return interaction.editReply(permissionCheck.message);
  }
  
  const result = await robloxAPI.setUserRole(userId, config.groupId, nextRole.id, ROBLOX_COOKIE);
  
  if (result) {
    await sendRankChangeWebhook({
      type: 'promotion',
      targetUser: robloxNick,
      manager: permissionCheck.managerUsername,
      managerRank: permissionCheck.managerRank.name,
      oldRank: `${currentRank.name} (${currentRank.rank})`,
      newRank: `${nextRole.name} (${nextRole.rank})`
    });
    
    const embed = new EmbedBuilder()
      .setTitle('Terfi İşlemi')
      .setDescription(`**${robloxNick}** kullanıcısı 1x terfi edildi`)
      .addFields(
        { name: 'İlgili Kişi', value: `${permissionCheck.managerUsername} (${permissionCheck.managerRank.name})`, inline: false },
        { name: 'Eski Rütbe', value: currentRank.name, inline: true },
        { name: 'Yeni Rütbe', value: nextRole.name, inline: true }
      )
      .setColor(0x57F287)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('HATA: Terfi işlemi başarısız!');
  }
}

async function handleRankDemotion(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  
  if (!userId) {
    return interaction.editReply('HATA: Hedef kullanıcı bulunamadı!');
  }
  
  const currentRank = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  if (!currentRank) {
    return interaction.editReply('HATA: Kullanıcı grupta değil!');
  }
  
  const roles = await robloxAPI.getGroupRoles(config.groupId);
  if (!roles) {
    return interaction.editReply('HATA: Grup rütbeleri alınamadı! Grup ID\'sini kontrol edin.');
  }
  
  const sortedRoles = roles.sort((a, b) => a.rank - b.rank);
  const currentIndex = sortedRoles.findIndex(r => r.rank === currentRank.rank);
  
  if (currentIndex === 0) {
    return interaction.editReply('HATA: Kullanıcı zaten en alt rütbede!');
  }
  
  const prevRole = sortedRoles[currentIndex - 1];
  
  const permissionCheck = await checkRankPermissions(interaction.user.id, prevRole.rank);
  if (!permissionCheck.allowed) {
    return interaction.editReply(permissionCheck.message);
  }
  
  const result = await robloxAPI.setUserRole(userId, config.groupId, prevRole.id, ROBLOX_COOKIE);
  
  if (result) {
    await sendRankChangeWebhook({
      type: 'demotion',
      targetUser: robloxNick,
      manager: permissionCheck.managerUsername,
      managerRank: permissionCheck.managerRank.name,
      oldRank: `${currentRank.name} (${currentRank.rank})`,
      newRank: `${prevRole.name} (${prevRole.rank})`
    });
    
    const embed = new EmbedBuilder()
      .setTitle('Tenzil İşlemi')
      .setDescription(`**${robloxNick}** kullanıcısı 1x tenzil edildi`)
      .addFields(
        { name: 'İlgili Kişi', value: `${permissionCheck.managerUsername} (${permissionCheck.managerRank.name})`, inline: false },
        { name: 'Eski Rütbe', value: currentRank.name, inline: true },
        { name: 'Yeni Rütbe', value: prevRole.name, inline: true }
      )
      .setColor(0xED4245)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('HATA: Tenzil işlemi başarısız!');
  }
}

async function handleBan(interaction) {
  if (!interaction.member.roles.cache.some(role => config.adminRoleIds.includes(role.id))) {
    return interaction.reply({ content: 'HATA: Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const discordUserId = interaction.options.getString('kullanici_id');
  
  try {
    const user = await client.users.fetch(discordUserId);
    const guilds = client.guilds.cache;
    
    let successCount = 0;
    let failCount = 0;
    const failedGuilds = [];
    
    for (const [guildId, guild] of guilds) {
      try {
        await guild.members.ban(discordUserId, { reason: 'Tam yasak komutu ile yasaklandı' });
        successCount++;
      } catch (error) {
        failCount++;
        failedGuilds.push(guild.name);
        console.error(`${guild.name} sunucusunda yasaklama hatası:`, error.message);
      }
    }
    
    const embed = new EmbedBuilder()
      .setTitle('Tam Yasak Uygulandı')
      .setDescription(`**${user.tag}** botun bulunduğu sunuculardan yasaklandı`)
      .addFields(
        { name: 'Yasaklanan Kullanıcı', value: user.tag, inline: true },
        { name: 'Discord ID', value: discordUserId, inline: true },
        { name: 'Başarılı', value: `${successCount} sunucu`, inline: true },
        { name: 'Başarısız', value: `${failCount} sunucu`, inline: true }
      )
      .setColor(successCount > 0 ? 0xED4245 : 0xFEE75C)
      .setTimestamp();
    
    if (failedGuilds.length > 0 && failedGuilds.length <= 5) {
      embed.addFields({ name: 'Başarısız Sunucular', value: failedGuilds.join(', '), inline: false });
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Yasaklama hatası:', error);
    await interaction.editReply('HATA: Kullanıcı yasaklanamadı! Kullanıcı ID\'sini kontrol edin.');
  }
}

async function handleUnban(interaction) {
  if (!interaction.member.roles.cache.some(role => config.adminRoleIds.includes(role.id))) {
    return interaction.reply({ content: 'HATA: Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const discordUserId = interaction.options.getString('kullanici_id');
  
  try {
    const guilds = client.guilds.cache;
    
    let successCount = 0;
    let failCount = 0;
    const failedGuilds = [];
    
    for (const [guildId, guild] of guilds) {
      try {
        await guild.members.unban(discordUserId, 'Tam yasak kaldırma komutu ile yasak kaldırıldı');
        successCount++;
      } catch (error) {
        failCount++;
        failedGuilds.push(guild.name);
        console.error(`${guild.name} sunucusunda yasak kaldırma hatası:`, error.message);
      }
    }
    
    const embed = new EmbedBuilder()
      .setTitle('Tam Yasak Kaldırıldı')
      .setDescription(`**${discordUserId}** ID'li kullanıcının botun bulunduğu sunuculardan yasağı kaldırıldı`)
      .addFields(
        { name: 'Discord ID', value: discordUserId, inline: true },
        { name: 'Başarılı', value: `${successCount} sunucu`, inline: true },
        { name: 'Başarısız', value: `${failCount} sunucu`, inline: true }
      )
      .setColor(successCount > 0 ? 0x57F287 : 0xFEE75C)
      .setTimestamp();
    
    if (failedGuilds.length > 0 && failedGuilds.length <= 5) {
      embed.addFields({ name: 'Başarısız Sunucular', value: failedGuilds.join(', '), inline: false });
    }
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Yasak kaldırma hatası:', error);
    await interaction.editReply('HATA: Yasak kaldırılamadı! Kullanıcı ID\'sini kontrol edin.');
  }
}

async function handleActivityQuery(interaction) {
  await interaction.deferReply();
  
  const activity = await robloxAPI.getGameActivity(config.gameId);
  
  if (!activity) {
    return interaction.editReply('HATA: Oyun bilgisi alınamadı!');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Oyun Aktifliği')
    .setDescription(`**${activity.name}** istatistikleri`)
    .addFields(
      { name: 'Şu An Oynayan', value: activity.playing.toString(), inline: true },
      { name: 'Maksimum Oyuncu', value: activity.maxPlayers.toString(), inline: true },
      { name: 'Toplam Ziyaret', value: activity.visits.toLocaleString(), inline: true }
    )
    .setColor(0x5865F2)
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleGroupList(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('HATA: Roblox kullanıcısı bulunamadı!');
  }
  
  const groups = await robloxAPI.getUserGroups(userId);
  
  if (!groups || groups.length === 0) {
    return interaction.editReply(`**${robloxNick}** kullanıcısı hiçbir grupta değil!`);
  }
  
  const groupList = groups.map((g, index) => 
    `**${index + 1}.** ${g.groupName}\n└ Rütbe: ${g.roleName} (${g.rank})`
  ).join('\n\n');
  
  const embed = new EmbedBuilder()
    .setTitle('Grup Listesi')
    .setDescription(`**${robloxNick}** kullanıcısının bulunduğu gruplar:\n\n${groupList}`)
    .setColor(0x5865F2)
    .setFooter({ text: `Toplam ${groups.length} grup` })
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleBranchRankChange(interaction) {
  await interaction.deferReply();
  
  const managerUsername = getLinkedRobloxUsername(interaction.user.id);
  if (!managerUsername) {
    return interaction.editReply('HATA: Discord hesabınız bir Roblox hesabına bağlı değil! Önce `/roblox-bağla` komutunu kullanarak hesabınızı bağlayın.');
  }

  const managerId = await robloxAPI.getUserIdByUsername(managerUsername);
  if (!managerId) {
    return interaction.editReply('HATA: Bağlı Roblox kullanıcısı bulunamadı! Hesap bağlantınızı kontrol edin.');
  }
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const branch = interaction.options.getString('branş');
  const targetRankName = interaction.options.getString('rütbe');
  const reason = interaction.options.getString('sebep');
  
  const branchGroupId = config.branchGroups[branch];
  
  if (!branchGroupId || branchGroupId === 'GRUP_ID_BURAYA') {
    return interaction.editReply(`HATA: ${branch} branşı için grup ID tanımlanmamış! Config dosyasını kontrol edin.`);
  }

  const managerRank = await robloxAPI.getUserRankInGroup(managerId, branchGroupId);
  if (!managerRank) {
    return interaction.editReply(`HATA: **${branch}** branş grubunda olmayan kişiler bu branşta rütbe işlemi yapamaz!`);
  }

  if (config.branchManagerRanks && !config.branchManagerRanks.includes(managerRank.rank)) {
    return interaction.editReply(`HATA: Sadece ${config.branchManagerRanks.join(', ')} rütbeli kişiler branş rütbe işlemi yapabilir! (Sizin **${branch}** branşındaki rütbeniz: ${managerRank.rank})`);
  }
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('HATA: Roblox kullanıcısı bulunamadı!');
  }
  
  const currentRank = await robloxAPI.getUserRankInGroup(userId, branchGroupId);
  if (!currentRank) {
    return interaction.editReply(`HATA: Kullanıcı **${branch}** branş grubunda değil!`);
  }
  
  const branchRoles = await robloxAPI.getGroupRoles(branchGroupId);
  if (!branchRoles) {
    return interaction.editReply('HATA: Branş grup rütbeleri alınamadı!');
  }
  
  const targetRole = branchRoles.find(r => r.name.toLowerCase() === targetRankName.toLowerCase());
  if (!targetRole) {
    return interaction.editReply(`HATA: **${targetRankName}** rütbesi **${branch}** branşında bulunamadı!`);
  }
  
  const result = await robloxAPI.setUserRole(userId, branchGroupId, targetRole.id, ROBLOX_COOKIE);
  
  if (result) {
    await sendRankChangeWebhook({
      type: 'branch',
      targetUser: robloxNick,
      manager: managerUsername,
      managerRank: managerRank.name,
      oldRank: `${currentRank.name} (${currentRank.rank})`,
      newRank: `${targetRole.name} (${targetRole.rank})`,
      branch: branch,
      reason: reason
    });
    
    const embed = new EmbedBuilder()
      .setTitle('Branş Rütbe Değiştirildi')
      .setDescription(`**${robloxNick}** kullanıcısının **${branch}** branşındaki rütbesi değiştirildi`)
      .addFields(
        { name: 'İlgili Kişi', value: `${managerUsername} (${managerRank.name})`, inline: true },
        { name: 'Branş', value: branch, inline: true },
        { name: 'Eski Rütbe', value: currentRank.name, inline: true },
        { name: 'Yeni Rütbe', value: targetRole.name, inline: true },
        { name: 'Sebep', value: reason, inline: false }
      )
      .setColor(0x5865F2)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('HATA: Rütbe değiştirilemedi! Cookie kontrolü yapın veya bot yetkilerini kontrol edin.');
  }
}

async function handleBranchRequest(interaction) {
  await interaction.deferReply();
  
  const managerUsername = getLinkedRobloxUsername(interaction.user.id);
  if (!managerUsername) {
    return interaction.editReply('HATA: Discord hesabınız bir Roblox hesabına bağlı değil! Önce `/roblox-bağla` komutunu kullanarak hesabınızı bağlayın.');
  }

  const managerId = await robloxAPI.getUserIdByUsername(managerUsername);
  if (!managerId) {
    return interaction.editReply('HATA: Bağlı Roblox kullanıcısı bulunamadı! Hesap bağlantınızı kontrol edin.');
  }
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const branch = interaction.options.getString('branş');
  const decision = interaction.options.getString('karar');
  const reason = interaction.options.getString('sebep');
  
  const branchGroupId = config.branchGroups[branch];
  
  if (!branchGroupId || branchGroupId === 'GRUP_ID_BURAYA') {
    return interaction.editReply(`HATA: ${branch} branşı için grup ID tanımlanmamış! Config dosyasını kontrol edin.`);
  }

  const managerRank = await robloxAPI.getUserRankInGroup(managerId, branchGroupId);
  if (!managerRank) {
    return interaction.editReply(`HATA: **${branch}** branş grubunda olmayan kişiler bu branşta işlem yapamaz!`);
  }

  if (config.branchManagerRanks && !config.branchManagerRanks.includes(managerRank.rank)) {
    return interaction.editReply(`HATA: Sadece ${config.branchManagerRanks.join(', ')} rütbeli kişiler branş işlemi yapabilir! (Sizin **${branch}** branşındaki rütbeniz: ${managerRank.rank})`);
  }
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('HATA: Roblox kullanıcısı bulunamadı!');
  }
  
  let result;
  if (decision === 'kabul') {
    result = await robloxAPI.acceptJoinRequest(branchGroupId, userId, ROBLOX_COOKIE);
  } else {
    result = await robloxAPI.rejectJoinRequest(branchGroupId, userId, ROBLOX_COOKIE);
  }
  
  if (result) {
    const embed = new EmbedBuilder()
      .setTitle(decision === 'kabul' ? '✅ İstek Kabul Edildi' : '❌ İstek Reddedildi')
      .setDescription(`**${robloxNick}** kullanıcısının **${branch}** branşı isteği ${decision === 'kabul' ? 'kabul edildi' : 'reddedildi'}`)
      .addFields(
        { name: 'İlgili Kişi', value: `${managerUsername} (${managerRank.name})`, inline: true },
        { name: 'Branş', value: branch, inline: true },
        { name: 'Karar', value: decision === 'kabul' ? 'Kabul' : 'Red', inline: true },
        { name: 'Sebep', value: reason, inline: false }
      )
      .setColor(decision === 'kabul' ? 0x57F287 : 0xED4245)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply(`HATA: İstek ${decision === 'kabul' ? 'kabul' : 'red'} edilemedi! Kullanıcının gruba istek göndermediğinden emin olun.`);
  }
}

async function handleRobloxLink(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  cleanExpiredVerifications();
  
  const discordUserId = interaction.user.id;
  
  // Hesap zaten bağlı mı kontrol et
  const existingLink = getLinkedRobloxUsername(discordUserId);
  if (existingLink) {
    return interaction.editReply(`HATA: Discord hesabınız zaten **${existingLink}** kullanıcısına bağlı! Hesabınızı değiştirmek için \`/roblox-değiştir\` komutunu kullanın.`);
  }
  
  const robloxNick = interaction.options.getString('roblox_nick');
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('HATA: Roblox kullanıcısı bulunamadı! Kullanıcı adını kontrol edin.');
  }
  
  const rankInfo = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  if (!rankInfo) {
    return interaction.editReply('HATA: Bu Roblox kullanıcısı grupta değil! Lütfen önce gruba katılın.');
  }
  
  // Bekleyen doğrulama var mı kontrol et
  const pendingVerifications = loadPendingVerifications();
  const pendingVerification = pendingVerifications[discordUserId];
  
  // Eğer bekleyen doğrulama varsa, kodu kontrol et
  if (pendingVerification) {
    const isVerified = await robloxAPI.verifyUserOwnership(userId, pendingVerification.code);
    
    if (isVerified) {
      // Doğrulama başarılı - hesabı bağla
      const links = loadAccountLinks();
      links[discordUserId] = robloxNick;
      
      // Bekleyen doğrulamayı sil
      delete pendingVerifications[discordUserId];
      savePendingVerifications(pendingVerifications);
      
      if (saveAccountLinks(links)) {
        const embed = new EmbedBuilder()
          .setTitle('Hesap Bağlandı')
          .setDescription('Discord hesabınız Roblox hesabınıza başarıyla bağlandı')
          .addFields(
            { name: 'Discord Kullanıcısı', value: interaction.user.tag, inline: true },
            { name: 'Roblox Kullanıcısı', value: robloxNick, inline: true },
            { name: 'Rütbe', value: `${rankInfo.name} (Seviye ${rankInfo.rank})`, inline: true }
          )
          .setColor(0x57F287)
          .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply('HATA: Hesap bağlantısı kaydedilemedi! Lütfen tekrar deneyin.');
      }
    }
  }
  
  // Yeni doğrulama kodu oluştur
  const verificationCode = generateVerificationCode();
  pendingVerifications[discordUserId] = {
    code: verificationCode,
    robloxUsername: robloxNick,
    timestamp: Date.now()
  };
  savePendingVerifications(pendingVerifications);
  
  const verificationEmbed = new EmbedBuilder()
    .setTitle('Hesap Doğrulama Gerekli')
    .setDescription('Hesabınızı bağlamak için Roblox profil açıklamanıza aşağıdaki doğrulama kodunu eklemeniz gerekiyor.')
    .addFields(
      { name: 'Adım 1', value: 'Roblox profilinize gidin', inline: false },
      { name: 'Adım 2', value: `Profil açıklamanıza şu doğrulama kodunu ekleyin:\n\`\`\`${verificationCode}\`\`\``, inline: false },
      { name: 'Adım 3', value: 'Kaydedin ve tekrar `/roblox-bağla` komutunu kullanın', inline: false },
      { name: 'Not', value: 'Bu kod 10 dakika süreyle geçerlidir', inline: false }
    )
    .setColor(0xFEE75C)
    .setTimestamp();
  
  return interaction.editReply({ embeds: [verificationEmbed] });
}

async function handleRobloxChange(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  cleanExpiredVerifications();
  
  const discordUserId = interaction.user.id;
  
  // Hesap bağlı mı kontrol et
  const existingLink = getLinkedRobloxUsername(discordUserId);
  if (!existingLink) {
    return interaction.editReply('HATA: Discord hesabınız henüz bir Roblox hesabına bağlı değil! Önce `/roblox-bağla` komutunu kullanın.');
  }
  
  const robloxNick = interaction.options.getString('roblox_nick');
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('HATA: Roblox kullanıcısı bulunamadı! Kullanıcı adını kontrol edin.');
  }
  
  const rankInfo = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  if (!rankInfo) {
    return interaction.editReply('HATA: Bu Roblox kullanıcısı grupta değil! Lütfen önce gruba katılın.');
  }
  
  // Bekleyen doğrulama var mı kontrol et
  const pendingVerifications = loadPendingVerifications();
  const pendingVerification = pendingVerifications[discordUserId];
  
  // Eğer bekleyen doğrulama varsa, kodu kontrol et
  if (pendingVerification) {
    const isVerified = await robloxAPI.verifyUserOwnership(userId, pendingVerification.code);
    
    if (isVerified) {
      // Doğrulama başarılı - hesabı değiştir
      const links = loadAccountLinks();
      const oldUsername = links[discordUserId];
      links[discordUserId] = robloxNick;
      
      // Bekleyen doğrulamayı sil
      delete pendingVerifications[discordUserId];
      savePendingVerifications(pendingVerifications);
      
      if (saveAccountLinks(links)) {
        const embed = new EmbedBuilder()
          .setTitle('Hesap Değiştirildi')
          .setDescription('Bağlı Roblox hesabınız başarıyla değiştirildi')
          .addFields(
            { name: 'Discord Kullanıcısı', value: interaction.user.tag, inline: true },
            { name: 'Eski Roblox Hesabı', value: oldUsername, inline: true },
            { name: 'Yeni Roblox Hesabı', value: robloxNick, inline: true },
            { name: 'Rütbe', value: `${rankInfo.name} (Seviye ${rankInfo.rank})`, inline: true }
          )
          .setColor(0x5865F2)
          .setTimestamp();
        
        return interaction.editReply({ embeds: [embed] });
      } else {
        return interaction.editReply('HATA: Hesap değişikliği kaydedilemedi! Lütfen tekrar deneyin.');
      }
    }
  }
  
  // Yeni doğrulama kodu oluştur
  const verificationCode = generateVerificationCode();
  pendingVerifications[discordUserId] = {
    code: verificationCode,
    robloxUsername: robloxNick,
    timestamp: Date.now()
  };
  savePendingVerifications(pendingVerifications);
  
  const verificationEmbed = new EmbedBuilder()
    .setTitle('Hesap Doğrulama Gerekli')
    .setDescription('Hesabınızı değiştirmek için yeni Roblox profil açıklamanıza aşağıdaki doğrulama kodunu eklemeniz gerekiyor.')
    .addFields(
      { name: 'Mevcut Bağlı Hesap', value: existingLink, inline: false },
      { name: 'Yeni Hesap', value: robloxNick, inline: false },
      { name: 'Adım 1', value: `**${robloxNick}** Roblox profilinize gidin`, inline: false },
      { name: 'Adım 2', value: `Profil açıklamanıza şu doğrulama kodunu ekleyin:\n\`\`\`${verificationCode}\`\`\``, inline: false },
      { name: 'Adım 3', value: 'Kaydedin ve tekrar `/roblox-değiştir` komutunu kullanın', inline: false },
      { name: 'Not', value: 'Bu kod 10 dakika süreyle geçerlidir', inline: false }
    )
    .setColor(0xFEE75C)
    .setTimestamp();
  
  return interaction.editReply({ embeds: [verificationEmbed] });
}

async function handleAnnouncement(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const mesaj = interaction.options.getString('mesaj');
  const kanalAdi = interaction.options.getString('kanal_adi');
  const member = interaction.member;
  
  let rolAdi;
  if (interaction.user.username === 'emir_1881') {
    rolAdi = 'İttifak Ordusu Bot Geliştiricisi';
  } else {
    const highestRole = member.roles.highest;
    rolAdi = highestRole.name;
  }
  
  const duyuruMetni = `${mesaj}\n\n-# ${interaction.user.username}, ${rolAdi}`;
  
  const guilds = client.guilds.cache;
  let successCount = 0;
  let failCount = 0;
  const failedGuilds = [];
  
  for (const [guildId, guild] of guilds) {
    try {
      const kanal = guild.channels.cache.find(ch => 
        ch.name.toLowerCase() === kanalAdi.toLowerCase() && ch.isTextBased()
      );
      
      if (kanal) {
        await kanal.send(duyuruMetni);
        successCount++;
      } else {
        failCount++;
        failedGuilds.push(`${guild.name} (kanal bulunamadı)`);
      }
    } catch (error) {
      console.error(`${guild.name} sunucusunda duyuru hatası:`, error.message);
      failCount++;
      failedGuilds.push(`${guild.name} (${error.message})`);
    }
  }
  
  let sonucMesaji = `**Duyuru Gönderildi**\n\n`;
  sonucMesaji += `Kanal: **${kanalAdi}**\n`;
  sonucMesaji += `✓ Başarılı: ${successCount} sunucu\n`;
  
  if (failCount > 0) {
    sonucMesaji += `✗ Başarısız: ${failCount} sunucu\n`;
    if (failedGuilds.length > 0 && failedGuilds.length <= 10) {
      sonucMesaji += `\nBaşarısız sunucular:\n${failedGuilds.map(g => `- ${g}`).join('\n')}`;
    }
  }
  
  await interaction.editReply(sonucMesaji);
}

client.login(DISCORD_TOKEN);
