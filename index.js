const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  EmbedBuilder, 
  SlashCommandBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder
} = require('discord.js');
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
const ACTIVE_TICKETS_FILE = './active_tickets.json';

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
    console.warn('\nKonfigürasyon Uyarıları:');
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

function loadActiveTickets() {
  try {
    if (fs.existsSync(ACTIVE_TICKETS_FILE)) {
      const data = fs.readFileSync(ACTIVE_TICKETS_FILE, 'utf8');
      if (!data || data.trim() === '') {
        return {};
      }
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Aktif ticketlar yüklenirken hata:', error.message);
  }
  return {};
}

function saveActiveTickets(tickets) {
  try {
    fs.writeFileSync(ACTIVE_TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Aktif ticketlar kaydedilirken hata:', error);
    return false;
  }
}

async function sendRankChangeWebhook(data) {
  if (!config.webhookUrl || config.webhookUrl === 'WEBHOOK_URL_BURAYA') {
    return;
  }
  
  try {
    const embed = {
      title: data.type === 'change' ? 'Rütbe Değişikliği' : 
             data.type === 'promotion' ? 'Terfi' : 
             data.type === 'demotion' ? 'Tenzil' : 
             'Branş Rütbe Değişikliği',
      color: data.type === 'promotion' ? 0x57F287 : 
             data.type === 'demotion' ? 0xED4245 : 
             0x5865F2,
      fields: [
        {
          name: 'Hedef Kullanıcı',
          value: data.targetUser,
          inline: true
        },
        {
          name: 'İşlemi Yapan',
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
        name: 'Eski Rütbe',
        value: data.oldRank,
        inline: true
      });
    }
    
    embed.fields.push({
      name: 'Yeni Rütbe',
      value: data.newRank,
      inline: true
    });
    
    if (data.branch) {
      embed.fields.push({
        name: 'Branş',
        value: data.branch,
        inline: true
      });
    }
    
    if (data.reason) {
      embed.fields.push({
        name: 'Sebep',
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

async function sendBranchRequestWebhook(data) {
  const webhookUrl = config.branchWebhookUrl && config.branchWebhookUrl !== 'WEBHOOK_URL_BURAYA' 
    ? config.branchWebhookUrl 
    : config.webhookUrl;
    
  if (!webhookUrl || webhookUrl === 'WEBHOOK_URL_BURAYA') {
    return;
  }
  
  try {
    const embed = {
      title: data.decision === 'kabul' ? 'Branş İsteği Kabul Edildi' : 'Branş İsteği Reddedildi',
      color: data.decision === 'kabul' ? 0x57F287 : 0xED4245,
      fields: [
        {
          name: 'Hedef Kullanıcı',
          value: data.targetUser,
          inline: true
        },
        {
          name: 'İşlemi Yapan',
          value: `${data.manager} (${data.managerRank})`,
          inline: true
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true
        },
        {
          name: 'Branş',
          value: data.branch,
          inline: true
        },
        {
          name: 'Karar',
          value: data.decision === 'kabul' ? 'Kabul Edildi' : 'Reddedildi',
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
        text: 'Branş İstek Log Sistemi'
      }
    };
    
    if (data.reason) {
      embed.fields.push({
        name: 'Sebep',
        value: data.reason,
        inline: false
      });
    }
    
    await axios.post(webhookUrl, {
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
      option.setName('kişi')
        .setDescription('Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('rütbe-değiştir')
    .setDescription('Belirtilen rütbeyi kullanıcıya verir')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Rütbe verilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
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
    .setName('rütbe-terfi')
    .setDescription('Kullanıcıya 1x terfi verir')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Terfi edilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Terfi sebebi')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('rütbe-tenzil')
    .setDescription('Kullanıcıya 1x tenzil verir')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Tenzil edilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Tenzil sebebi')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('tamyasak')
    .setDescription('Kullanıcıyı botun bulunduğu tüm sunuculardan yasaklar')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Discord kullanıcı ID\'si')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Yasaklama sebebi')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('tamyasak-kaldır')
    .setDescription('Kullanıcının botun bulunduğu tüm sunuculardan yasağını kaldırır')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Discord kullanıcı ID\'si')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('sebep')
        .setDescription('Yasak kaldırma sebebi')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('aktiflik-sorgu')
    .setDescription('Grup oyununun aktifliğini sorgular'),
  
  new SlashCommandBuilder()
    .setName('roblox-bağla')
    .setDescription('Discord hesabınızı Roblox hesabınıza bağlar')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Roblox kullanıcı adınız')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('roblox-değiştir')
    .setDescription('Bağlı Roblox hesabınızı değiştirir')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Yeni Roblox kullanıcı adınız')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('grup-listele')
    .setDescription('Kullanıcının bulunduğu tüm grupları ve rütbelerini listeler')
    .addStringOption(option =>
      option.setName('kişi')
        .setDescription('Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('branş-istek')
    .setDescription('Branş grup isteğini kabul veya reddeder')
    .addStringOption(option =>
      option.setName('kişi')
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
      option.setName('kişi')
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
    .addAttachmentOption(option =>
      option.setName('görsel')
        .setDescription('Duyuruya eklenecek görsel (opsiyonel)')
        .setRequired(false)
    ),
  
  new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('Destek sistemi mesajını gönderir')
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
  if (interaction.isChatInputCommand()) {
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
        case 'ticket-setup':
          await handleTicketSetup(interaction);
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
  }
  else if (interaction.isButton()) {
    try {
      if (interaction.customId === 'open_ticket_menu') {
        await handleTicketMenuButton(interaction);
      } else if (interaction.customId === 'close_ticket') {
        await handleTicketClose(interaction);
      } else if (interaction.customId === 'claim_ticket') {
        await handleTicketClaim(interaction);
      } else if (interaction.customId.startsWith('rate_ticket_')) {
        const parts = interaction.customId.split('_');
        const rating = parseInt(parts[2]);
        const ticketOwnerId = parts[3];
        await handleTicketRating(interaction, rating, ticketOwnerId);
      }
    } catch (error) {
      console.error('Buton hatası:', error);
      await interaction.reply({ content: 'HATA: Bir hata oluştu!', flags: 64 }).catch(() => {});
    }
  }
  else if (interaction.isStringSelectMenu()) {
    try {
      if (interaction.customId === 'ticket_category') {
        await handleTicketCategorySelect(interaction);
      }
    } catch (error) {
      console.error('Select menu hatası:', error);
      await interaction.reply({ content: 'HATA: Bir hata oluştu!', flags: 64 }).catch(() => {});
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
    managerId: managerId,
    maxAllowedRank: maxAllowedRank 
  };
}

async function handleRankQuery(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('kişi');
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
  
  const robloxNick = interaction.options.getString('kişi');
  const targetRankName = interaction.options.getString('rütbe');
  const reason = interaction.options.getString('sebep');
  
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
  
  if (userId === permissionCheck.managerId) {
    return interaction.editReply('HATA: Kendi rütbeni değiştiremezsin!');
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
    
    const oldRankText = currentRank ? currentRank.name : 'Bilinmiyor';
    const embed = new EmbedBuilder()
      .setDescription(`İşlem başarıyla tamamlandı\n\n${robloxNick} (${userId}) kişisini, ${oldRankText} rütbesinden ${targetRole.name} rütbesine başarıyla değiştirdin.\n\n**Sebep**\n${reason}`)
      .setColor(0x57F287);
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('HATA: Rütbe değiştirilemedi! Cookie kontrolü yapın.');
  }
}

async function handleRankPromotion(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('kişi');
  const reason = interaction.options.getString('sebep');
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
  
  if (userId === permissionCheck.managerId) {
    return interaction.editReply('HATA: Kendi rütbeni değiştiremezsin!');
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
      .setDescription(`İşlem başarıyla tamamlandı\n\n${robloxNick} (${userId}) kişisini, ${currentRank.name} rütbesinden ${nextRole.name} rütbesine başarıyla değiştirdin.\n\n**Sebep**\n${reason}`)
      .setColor(0x57F287);
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('HATA: Terfi işlemi başarısız!');
  }
}

async function handleRankDemotion(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('kişi');
  const reason = interaction.options.getString('sebep');
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
  
  if (userId === permissionCheck.managerId) {
    return interaction.editReply('HATA: Kendi rütbeni değiştiremezsin!');
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
      .setDescription(`İşlem başarıyla tamamlandı\n\n${robloxNick} (${userId}) kişisini, ${currentRank.name} rütbesinden ${prevRole.name} rütbesine başarıyla değiştirdin.\n\n**Sebep**\n${reason}`)
      .setColor(0x57F287);
    
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
  
  const discordUserId = interaction.options.getString('kişi');
  const reason = interaction.options.getString('sebep');
  
  try {
    const user = await client.users.fetch(discordUserId);
    const guilds = client.guilds.cache;
    
    const successGuilds = [];
    const failedGuilds = [];
    
    for (const [guildId, guild] of guilds) {
      try {
        await guild.members.ban(discordUserId, { reason: reason });
        successGuilds.push(guild.name);
      } catch (error) {
        failedGuilds.push(guild.name);
        console.error(`${guild.name} sunucusunda yasaklama hatası:`, error.message);
      }
    }
    
    const guildName = interaction.guild.name;
    const bannedUserTag = user.tag;
    let description = `İşlem başarıyla tamamlandı\n\n${bannedUserTag} Kişi başarıyla tüm ${guildName} sunucularından yasaklandı.\n\n**Sebep**\n${reason}\n\n`;
    
    if (successGuilds.length > 0) {
      description += `**Yasaklanan Sunucular**\n${successGuilds.map(name => `• | ${name}`).join('\n')}\n\n`;
    }
    
    if (failedGuilds.length > 0) {
      description += `**Yasaklanamayan Sunucular**\n${failedGuilds.map(name => `• | ${name}`).join('\n')}`;
    } else {
      description += `**Yasaklanamayan Sunucular**\nTüm sunucularda yasaklama başarılı.`;
    }
    
    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor(0x57F287);
    
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
  
  const discordUserId = interaction.options.getString('kişi');
  const reason = interaction.options.getString('sebep');
  
  try {
    const guilds = client.guilds.cache;
    
    const successGuilds = [];
    const failedGuilds = [];
    
    for (const [guildId, guild] of guilds) {
      try {
        await guild.members.unban(discordUserId, `Tam yasak kaldırma: ${reason}`);
        successGuilds.push(guild.name);
      } catch (error) {
        failedGuilds.push(guild.name);
        console.error(`${guild.name} sunucusunda yasak kaldırma hatası:`, error.message);
      }
    }
    
    let description = `İşlem başarıyla tamamlandı\n\n<@${discordUserId}> Kişisinin TAK sunucularından yasaklamaları başarıyla kaldırıldı.\n\n**Sebep**\n${reason}\n\n`;
    
    if (successGuilds.length > 0) {
      description += `**Yasağın kaldırıldığı sunucular:**\n${successGuilds.map(name => `• | ${name}`).join('\n')}\n\n`;
    }
    
    if (failedGuilds.length > 0) {
      description += `**Yasağın kaldırılamadığı sunucular:**\n${failedGuilds.map(name => `• | ${name}`).join('\n')}`;
    } else {
      description += `**Yasağın kaldırılamadığı sunucular:**\nTüm sunucularda yasak kaldırıldı.`;
    }
    
    const embed = new EmbedBuilder()
      .setDescription(description)
      .setColor(0x57F287);
    
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
    .setTitle('🎮 Oyun Aktifliği')
    .setDescription(`**${activity.name}** oyununun anlık istatistikleri`)
    .addFields(
      { name: '👥 Aktif Oyuncu', value: `\`${activity.playing.toLocaleString('tr-TR')}\``, inline: true },
      { name: '📊 Maksimum Oyuncu', value: `\`${activity.maxPlayers.toLocaleString('tr-TR')}\``, inline: true },
      { name: '👁️ Toplam Ziyaret', value: `\`${activity.visits.toLocaleString('tr-TR')}\``, inline: true }
    )
    .setColor(0x57F287)
    .setTimestamp()
    .setFooter({ text: 'Aktiflik Sorgu Sistemi' });
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleGroupList(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('kişi');
  
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
  
  const robloxNick = interaction.options.getString('kişi');
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
  
  if (userId === managerId) {
    return interaction.editReply('HATA: Kendi rütbeni değiştiremezsin!');
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
      .setDescription(`İşlem başarıyla tamamlandı\n\n${robloxNick} (${userId}) kişisini, **${branch}** branşında ${currentRank.name} rütbesinden ${targetRole.name} rütbesine başarıyla değiştirdin.\n\n**Sebep**\n${reason}`)
      .setColor(0x57F287);
    
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
  
  const robloxNick = interaction.options.getString('kişi');
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
    await sendBranchRequestWebhook({
      decision: decision,
      targetUser: robloxNick,
      manager: managerUsername,
      managerRank: managerRank.name,
      branch: branch,
      reason: reason
    });
    
    const statusText = decision === 'kabul' ? 'kabul edildi' : 'reddedildi';
    const embed = new EmbedBuilder()
      .setDescription(`İşlem başarıyla tamamlandı\n\n${robloxNick} (${userId}) kişisinin **${branch}** branşı isteği ${statusText}.\n\n**Sebep**\n${reason}`)
      .setColor(decision === 'kabul' ? 0x57F287 : 0xED4245);
    
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
  
  const robloxNick = interaction.options.getString('kişi');
  
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
  
  const robloxNick = interaction.options.getString('kişi');
  
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
  const görsel = interaction.options.getAttachment('görsel');
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
        const messageOptions = { content: duyuruMetni };
        
        if (görsel) {
          messageOptions.files = [görsel.url];
        }
        
        await kanal.send(messageOptions);
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
  if (görsel) {
    sonucMesaji += `Görsel: ✓ Eklendi\n`;
  }
  sonucMesaji += `✓ Başarılı: ${successCount} sunucu\n`;
  
  if (failCount > 0) {
    sonucMesaji += `✗ Başarısız: ${failCount} sunucu\n`;
    if (failedGuilds.length > 0 && failedGuilds.length <= 10) {
      sonucMesaji += `\nBaşarısız sunucular:\n${failedGuilds.map(g => `- ${g}`).join('\n')}`;
    }
  }
  
  await interaction.editReply(sonucMesaji);
}

async function handleTicketSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.editReply('Bu komutu kullanmak için yönetici yetkisine sahip olmalısınız!');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('Turkish Armed Forces')
    .setDescription('**Moderatör Bileti**\nDiscord ile ilgili yaşanan sorunlar ve yardım talepleri için bu bileti seç.\n\n**Gamepass Bileti**\nRobux ile rütbe, branş üyeliği alımında bu bilet türünü seç.\n\n**Oyun Destek Bileti**\nOyunumuzda yaşanan sorunlar hakkında yardım almak için bu bileti seç.\n\n**Rütbe Destek Bileti**\nRütbeniz hakkında yaşanan sorunlar hakkında yardım almak için bu bileti seç.(Rütbem Gitti)\n\n**Reklam Destek Bileti**\nDiscord veya Oyun üzerinde reklam yapan insanları şikayet edebilmek için bu bilet türünü seç.\n\n**Geri Dönüş&Transfer Bileti**\nGeri dönüş veya transfer işlemleri hakkında destek almak için bu bileti seç.')
    .setColor(0x5865F2)
    .setFooter({ text: 'Destek Sistemi' });
  
  if (config.ticketImageUrl && config.ticketImageUrl !== 'GORSEL_URL_BURAYA' && config.ticketImageUrl.startsWith('http')) {
    embed.setImage(config.ticketImageUrl);
  }
  
  const button = new ButtonBuilder()
    .setCustomId('open_ticket_menu')
    .setLabel('Destek Kategorisi Seç!')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🎫');
  
  const row = new ActionRowBuilder().addComponents(button);
  
  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.editReply('Destek sistemi mesajı başarıyla gönderildi!');
}

async function handleTicketMenuButton(interaction) {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket_category')
    .setPlaceholder('Destek kategorisi seçiniz')
    .addOptions([
      {
        label: 'Moderatör Bileti',
        description: 'Discord ile ilgili yaşanan sorunlar ve yardım talepleri için bu bileti seç.',
        value: 'moderator',
        emoji: '🛡️'
      },
      {
        label: 'Gamepass Bileti',
        description: 'Robux ile rütbe, branş üyeliği alımında bu bilet türünü seç.',
        value: 'gamepass',
        emoji: '🎮'
      },
      {
        label: 'Oyun Destek Bileti',
        description: 'Oyunumuzda yaşanan sorunlar hakkında yardım almak için bu bileti seç.',
        value: 'game_support',
        emoji: '🎲'
      },
      {
        label: 'Rütbe Destek Bileti',
        description: 'Rütbeniz hakkında yaşanan sorunlar hakkında yardım almak için bu bileti seç.',
        value: 'rank_support',
        emoji: '👤'
      },
      {
        label: 'Reklam Destek Bileti',
        description: 'Discord veya Oyun üzerinde reklam yapan insanları şikayet edebilmek için.',
        value: 'ad_support',
        emoji: '🔧'
      },
      {
        label: 'Geri Dönüş&Transfer Bileti',
        description: 'Geri dönüş veya transfer işlemleri hakkında destek almak için bu bileti seç.',
        value: 'return_transfer',
        emoji: '🔄'
      }
    ]);
  
  const row = new ActionRowBuilder().addComponents(selectMenu);
  
  await interaction.reply({ 
    content: 'Lütfen destek kategorisi seçiniz:', 
    components: [row], 
    ephemeral: true 
  });
}

async function handleTicketCategorySelect(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const category = interaction.values[0];
  const userId = interaction.user.id;
  
  const activeTickets = loadActiveTickets();
  
  if (activeTickets[userId]) {
    return interaction.editReply('Zaten açık bir ticketınız var! Önce mevcut ticketı kapatmalısınız.');
  }
  
  const categoryNames = {
    'moderator': 'Moderatör',
    'gamepass': 'Gamepass',
    'game_support': 'Oyun Destek',
    'rank_support': 'Rütbe Destek',
    'ad_support': 'Reklam Destek',
    'return_transfer': 'Geri Dönüş&Transfer'
  };
  
  const categoryName = categoryNames[category] || 'Destek';
  const username = interaction.user.username.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const channelName = `ticket-${username}`;
  
  try {
    let parentId = null;
    if (config.ticketCategoryId && config.ticketCategoryId !== 'TICKET_CATEGORY_ID') {
      const categoryChannel = interaction.guild.channels.cache.get(config.ticketCategoryId);
      if (categoryChannel && categoryChannel.type === ChannelType.GuildCategory) {
        parentId = config.ticketCategoryId;
      }
    }
    
    const ticketChannel = await interaction.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: userId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        },
        ...config.supportRoleIds.map(roleId => ({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }))
      ]
    });
    
    const welcomeEmbed = new EmbedBuilder()
      .setTitle(`${categoryName} Ticket`)
      .setDescription(`Merhaba ${interaction.user}, destek ekibimiz en kısa sürede size yardımcı olacaktır.\n\nKategori: **${categoryName}**\n\nLütfen sorununuzu detaylı bir şekilde açıklayın.`)
      .setColor(0x5865F2)
      .setTimestamp();
    
    const closeButton = new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Kapat')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒');
    
    const claimButton = new ButtonBuilder()
      .setCustomId('claim_ticket')
      .setLabel('Ticket Al')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✋');
    
    const row = new ActionRowBuilder().addComponents(closeButton, claimButton);
    
    await ticketChannel.send({ 
      content: `${interaction.user} ${config.supportRoleIds.map(id => `<@&${id}>`).join(' ')}`,
      embeds: [welcomeEmbed],
      components: [row]
    });
    
    activeTickets[userId] = {
      channelId: ticketChannel.id,
      category: category,
      createdAt: Date.now(),
      claimedBy: null
    };
    saveActiveTickets(activeTickets);
    
    await interaction.editReply(`Ticketınız başarıyla oluşturuldu: ${ticketChannel}`);
    
    if (config.ticketLogChannelId && config.ticketLogChannelId !== 'TICKET_LOG_CHANNEL_ID') {
      const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('Yeni Ticket Açıldı')
          .addFields(
            { name: 'Kullanıcı', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Kategori', value: categoryName, inline: true },
            { name: 'Kanal', value: `${ticketChannel}`, inline: true }
          )
          .setColor(0x57F287)
          .setTimestamp();
        
        await logChannel.send({ embeds: [logEmbed] });
      }
    }
  } catch (error) {
    console.error('Ticket kanalı oluşturma hatası:', error);
    await interaction.editReply('Ticket kanalı oluşturulurken bir hata oluştu! Lütfen bot yetkilerini kontrol edin.');
  }
}

async function createTranscript(channel) {
  try {
    const messages = [];
    let lastId;
    
    while (true) {
      const options = { limit: 100 };
      if (lastId) {
        options.before = lastId;
      }
      
      const fetchedMessages = await channel.messages.fetch(options);
      if (fetchedMessages.size === 0) break;
      
      messages.push(...fetchedMessages.values());
      lastId = fetchedMessages.last().id;
      
      if (fetchedMessages.size < 100) break;
    }
    
    messages.reverse();
    
    let transcript = `TICKET TRANSCRIPT - ${channel.name}\n`;
    transcript += `Oluşturulma: ${new Date().toLocaleString('tr-TR')}\n`;
    transcript += `${'='.repeat(60)}\n\n`;
    
    for (const msg of messages) {
      const timestamp = msg.createdAt.toLocaleString('tr-TR');
      const author = msg.author.tag;
      const content = msg.content || '[Mesaj içeriği yok]';
      
      transcript += `[${timestamp}] ${author}:\n${content}\n`;
      
      if (msg.attachments.size > 0) {
        msg.attachments.forEach(att => {
          transcript += `  📎 Ek: ${att.url}\n`;
        });
      }
      
      if (msg.embeds.length > 0) {
        transcript += `  📋 ${msg.embeds.length} embed mesaj\n`;
      }
      
      transcript += '\n';
    }
    
    return transcript;
  } catch (error) {
    console.error('Transcript oluşturma hatası:', error);
    return null;
  }
}

async function handleTicketClose(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const activeTickets = loadActiveTickets();
  const userId = interaction.user.id;
  
  let ticketToClose = null;
  let ticketOwner = null;
  
  for (const [ownerId, ticket] of Object.entries(activeTickets)) {
    if (ticket.channelId === interaction.channel.id) {
      ticketToClose = ticket;
      ticketOwner = ownerId;
      break;
    }
  }
  
  if (!ticketToClose) {
    return interaction.editReply('Bu kanal bir ticket kanalı değil!');
  }
  
  const isOwner = userId === ticketOwner;
  const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                        config.supportRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
  
  if (!isOwner && !hasPermission) {
    return interaction.editReply('Bu ticketı kapatma yetkiniz yok!');
  }
  
  await interaction.editReply('Ticket kapatılıyor, transcript oluşturuluyor...');
  
  const transcript = await createTranscript(interaction.channel);
  
  const categoryNames = {
    'moderator': 'Moderatör',
    'gamepass': 'Gamepass',
    'game_support': 'Oyun Destek',
    'rank_support': 'Rütbe Destek',
    'ad_support': 'Reklam Destek',
    'return_transfer': 'Geri Dönüş&Transfer'
  };
  const categoryName = categoryNames[ticketToClose.category] || 'Destek';
  
  try {
    const ticketOwnerUser = await interaction.guild.members.fetch(ticketOwner);
    
    const dmEmbed = new EmbedBuilder()
      .setTitle('🎫 Ticket Kapatıldı')
      .setDescription(`**${categoryName}** kategorisindeki ticketınız kapatıldı.\n\nTicket konuşma geçmişi aşağıdadır.\n\nLütfen aldığınız hizmeti değerlendirin:`)
      .setColor(0x5865F2)
      .setTimestamp()
      .setFooter({ text: 'Destek Sistemi' });
    
    const ratingButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rate_ticket_1_${ticketOwner}`)
        .setLabel('⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rate_ticket_2_${ticketOwner}`)
        .setLabel('⭐⭐')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`rate_ticket_3_${ticketOwner}`)
        .setLabel('⭐⭐⭐')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`rate_ticket_4_${ticketOwner}`)
        .setLabel('⭐⭐⭐⭐')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rate_ticket_5_${ticketOwner}`)
        .setLabel('⭐⭐⭐⭐⭐')
        .setStyle(ButtonStyle.Success)
    );
    
    const dmMessage = { embeds: [dmEmbed], components: [ratingButtons] };
    
    if (transcript) {
      const buffer = Buffer.from(transcript, 'utf-8');
      dmMessage.files = [{
        attachment: buffer,
        name: `ticket-${interaction.channel.name}-transcript.txt`
      }];
    }
    
    await ticketOwnerUser.send(dmMessage);
  } catch (error) {
    console.error('DM gönderme hatası:', error);
    await interaction.followUp({ content: 'Kullanıcıya DM gönderilemedi (DM\'leri kapalı olabilir).', ephemeral: true });
  }
  
  if (config.ticketLogChannelId && config.ticketLogChannelId !== 'TICKET_LOG_CHANNEL_ID') {
    const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('Ticket Kapatıldı')
        .addFields(
          { name: 'Kapatılan Kanal', value: interaction.channel.name, inline: true },
          { name: 'Kapatan', value: `${interaction.user.tag}`, inline: true },
          { name: 'Ticket Sahibi', value: `<@${ticketOwner}>`, inline: true },
          { name: 'Kategori', value: categoryName, inline: true }
        )
        .setColor(0xED4245)
        .setTimestamp();
      
      const logMessage = { embeds: [logEmbed] };
      
      if (transcript) {
        const buffer = Buffer.from(transcript, 'utf-8');
        logMessage.files = [{
          attachment: buffer,
          name: `ticket-${interaction.channel.name}-transcript.txt`
        }];
      }
      
      await logChannel.send(logMessage);
    }
  }
  
  delete activeTickets[ticketOwner];
  saveActiveTickets(activeTickets);
  
  setTimeout(async () => {
    try {
      await interaction.channel.delete();
    } catch (error) {
      console.error('Ticket kanalı silme hatası:', error);
    }
  }, 5000);
}

async function handleTicketClaim(interaction) {
  await interaction.deferReply();
  
  const activeTickets = loadActiveTickets();
  const userId = interaction.user.id;
  
  let ticketToClaim = null;
  let ticketOwner = null;
  
  for (const [ownerId, ticket] of Object.entries(activeTickets)) {
    if (ticket.channelId === interaction.channel.id) {
      ticketToClaim = ticket;
      ticketOwner = ownerId;
      break;
    }
  }
  
  if (!ticketToClaim) {
    return interaction.editReply({ content: 'Bu kanal bir ticket kanalı değil!', ephemeral: true });
  }
  
  const hasPermission = config.supportRoleIds.some(roleId => interaction.member.roles.cache.has(roleId));
  
  if (!hasPermission) {
    return interaction.editReply({ content: 'Bu ticketı almak için destek yetkisine sahip olmalısınız!', ephemeral: true });
  }
  
  if (ticketToClaim.claimedBy) {
    const claimedUser = await interaction.guild.members.fetch(ticketToClaim.claimedBy).catch(() => null);
    const claimedUsername = claimedUser ? claimedUser.user.tag : 'Bilinmeyen Kullanıcı';
    return interaction.editReply({ content: `Bu ticket zaten ${claimedUsername} tarafından alınmış!`, ephemeral: true });
  }
  
  activeTickets[ticketOwner].claimedBy = userId;
  saveActiveTickets(activeTickets);
  
  const embed = new EmbedBuilder()
    .setDescription(`✅ ${interaction.user} bu ticket'ı üstlendi ve ilgilenecek.`)
    .setColor(0x57F287)
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
  
  if (config.ticketLogChannelId && config.ticketLogChannelId !== 'TICKET_LOG_CHANNEL_ID') {
    const logChannel = interaction.guild.channels.cache.get(config.ticketLogChannelId);
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setTitle('Ticket Alındı')
        .addFields(
          { name: 'Kanal', value: `${interaction.channel}`, inline: true },
          { name: 'Yetkili', value: `${interaction.user.tag}`, inline: true },
          { name: 'Ticket Sahibi', value: `<@${ticketOwner}>`, inline: true }
        )
        .setColor(0x57F287)
        .setTimestamp();
      
      await logChannel.send({ embeds: [logEmbed] });
    }
  }
}

async function handleTicketRating(interaction, rating, ticketOwnerId) {
  try {
    await interaction.deferReply({ ephemeral: true });
    
    if (interaction.user.id !== ticketOwnerId) {
      return interaction.editReply('Bu değerlendirmeyi sadece ticket sahibi yapabilir!');
    }
    
    const ratingEmojis = {
      1: '⭐',
      2: '⭐⭐',
      3: '⭐⭐⭐',
      4: '⭐⭐⭐⭐',
      5: '⭐⭐⭐⭐⭐'
    };
    
    await interaction.editReply(`Değerlendirmeniz alındı: ${ratingEmojis[rating]}\n\nGeri bildiriminiz için teşekkür ederiz!`);
    
    await interaction.message.edit({
      components: []
    });
    
    if (config.ticketLogChannelId && config.ticketLogChannelId !== 'TICKET_LOG_CHANNEL_ID') {
      const logChannel = await interaction.client.channels.fetch(config.ticketLogChannelId).catch(() => null);
      if (logChannel) {
        const ratingEmbed = new EmbedBuilder()
          .setTitle('⭐ Ticket Değerlendirmesi')
          .addFields(
            { name: 'Kullanıcı', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Puan', value: ratingEmojis[rating], inline: true },
            { name: 'Tarih', value: new Date().toLocaleString('tr-TR'), inline: true }
          )
          .setColor(rating >= 4 ? 0x57F287 : rating >= 3 ? 0xFEE75C : 0xED4245)
          .setTimestamp();
        
        await logChannel.send({ embeds: [ratingEmbed] });
      }
    }
  } catch (error) {
    console.error('Puanlama hatası:', error);
  }
}

client.login(DISCORD_TOKEN);
