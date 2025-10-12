const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const config = require('./config.json');
const robloxAPI = require('./src/roblox');

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
      option.setName('yonetici_roblox_nick')
        .setDescription('Kendi Roblox kullanıcı adınız (yetki kontrolü için)')
        .setRequired(true)
    )
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
    .setDescription('Kullanıcıya 1 seviye terfi verir')
    .addStringOption(option =>
      option.setName('yonetici_roblox_nick')
        .setDescription('Kendi Roblox kullanıcı adınız (yetki kontrolü için)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Terfi edilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('rütbe-tenzil')
    .setDescription('Kullanıcıya 1 seviye tenzil verir')
    .addStringOption(option =>
      option.setName('yonetici_roblox_nick')
        .setDescription('Kendi Roblox kullanıcı adınız (yetki kontrolü için)')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('roblox_nick')
        .setDescription('Tenzil edilecek kişinin Roblox kullanıcı adı')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('tam-yasakla')
    .setDescription('Kullanıcıyı Discord sunucusundan yasaklar')
    .addStringOption(option =>
      option.setName('kullanici_id')
        .setDescription('Discord kullanıcı ID\'si')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('tam-yasak-kaldır')
    .setDescription('Kullanıcının Discord sunucusundan yasağını kaldırır')
    .addStringOption(option =>
      option.setName('kullanici_id')
        .setDescription('Discord kullanıcı ID\'si')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('aktiflik-sorgu')
    .setDescription('Grup oyununun aktifliğini sorgular')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('Slash komutları kaydediliyor...');
    await rest.put(
      Routes.applicationCommands(DISCORD_CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Slash komutları başarıyla kaydedildi!');
  } catch (error) {
    console.error('Komut kaydı hatası:', error);
  }
})();

client.on('ready', () => {
  console.log(`✅ ${client.user.tag} olarak giriş yapıldı!`);
  console.log(`📊 Grup ID: ${config.groupId}`);
  console.log(`🎮 Oyun ID: ${config.gameId}`);
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
      case 'tam-yasakla':
        await handleBan(interaction);
        break;
      case 'tam-yasak-kaldır':
        await handleUnban(interaction);
        break;
      case 'aktiflik-sorgu':
        await handleActivityQuery(interaction);
        break;
    }
  } catch (error) {
    console.error(`Komut hatası (${commandName}):`, error);
    await interaction.reply({ content: '❌ Bir hata oluştu!', ephemeral: true });
  }
});

async function handleRankQuery(interaction) {
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  
  if (!userId) {
    return interaction.editReply('❌ Kullanıcı bulunamadı!');
  }
  
  const userInfo = await robloxAPI.getUserInfo(userId);
  const rankInfo = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  
  if (!rankInfo) {
    return interaction.editReply('❌ Kullanıcı grupta değil!');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Rütbe Sorgu')
    .setDescription(`**${robloxNick}** adlı kullanıcının rütbe bilgileri`)
    .addFields(
      { name: '👤 Roblox Kullanıcı Adı', value: userInfo.name, inline: true },
      { name: '🆔 Roblox ID', value: userId.toString(), inline: true },
      { name: '⭐ Rütbe', value: rankInfo.name, inline: true },
      { name: '🔢 Rütbe Seviyesi', value: rankInfo.rank.toString(), inline: true }
    )
    .setColor(0x00FF00)
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

async function handleRankChange(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    return interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const targetRankName = interaction.options.getString('rütbe');
  
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  if (!userId) {
    return interaction.editReply('❌ Kullanıcı bulunamadı!');
  }
  
  const roles = await robloxAPI.getGroupRoles(config.groupId);
  if (!roles) {
    return interaction.editReply('❌ Grup rütbeleri alınamadı! Grup ID\'sini kontrol edin.');
  }
  
  const targetRole = roles.find(r => r.name.toLowerCase() === targetRankName.toLowerCase());
  
  if (!targetRole) {
    return interaction.editReply('❌ Belirtilen rütbe bulunamadı!');
  }
  
  const result = await robloxAPI.setUserRole(userId, config.groupId, targetRole.id, ROBLOX_COOKIE);
  
  if (result) {
    const embed = new EmbedBuilder()
      .setTitle('✅ Rütbe Değiştirildi')
      .setDescription(`**${robloxNick}** adlı kullanıcının rütbesi değiştirildi`)
      .addFields(
        { name: '🆕 Yeni Rütbe', value: targetRole.name, inline: true },
        { name: '🔢 Rütbe Seviyesi', value: targetRole.rank.toString(), inline: true }
      )
      .setColor(0x0099FF)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('❌ Rütbe değiştirilemedi! Cookie kontrolü yapın.');
  }
}

async function handleRankPromotion(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    return interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  
  if (!userId) {
    return interaction.editReply('❌ Kullanıcı bulunamadı!');
  }
  
  const currentRank = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  if (!currentRank) {
    return interaction.editReply('❌ Kullanıcı grupta değil!');
  }
  
  const roles = await robloxAPI.getGroupRoles(config.groupId);
  if (!roles) {
    return interaction.editReply('❌ Grup rütbeleri alınamadı! Grup ID\'sini kontrol edin.');
  }
  
  const sortedRoles = roles.sort((a, b) => a.rank - b.rank);
  const currentIndex = sortedRoles.findIndex(r => r.rank === currentRank.rank);
  
  if (currentIndex === sortedRoles.length - 1) {
    return interaction.editReply('❌ Kullanıcı zaten en üst rütbede!');
  }
  
  const nextRole = sortedRoles[currentIndex + 1];
  const result = await robloxAPI.setUserRole(userId, config.groupId, nextRole.id, ROBLOX_COOKIE);
  
  if (result) {
    const embed = new EmbedBuilder()
      .setTitle('⬆️ Terfi Edildi')
      .setDescription(`**${robloxNick}** terfi edildi`)
      .addFields(
        { name: '📉 Eski Rütbe', value: currentRank.name, inline: true },
        { name: '📈 Yeni Rütbe', value: nextRole.name, inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('❌ Terfi işlemi başarısız!');
  }
}

async function handleRankDemotion(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    return interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const robloxNick = interaction.options.getString('roblox_nick');
  const userId = await robloxAPI.getUserIdByUsername(robloxNick);
  
  if (!userId) {
    return interaction.editReply('❌ Kullanıcı bulunamadı!');
  }
  
  const currentRank = await robloxAPI.getUserRankInGroup(userId, config.groupId);
  if (!currentRank) {
    return interaction.editReply('❌ Kullanıcı grupta değil!');
  }
  
  const roles = await robloxAPI.getGroupRoles(config.groupId);
  if (!roles) {
    return interaction.editReply('❌ Grup rütbeleri alınamadı! Grup ID\'sini kontrol edin.');
  }
  
  const sortedRoles = roles.sort((a, b) => a.rank - b.rank);
  const currentIndex = sortedRoles.findIndex(r => r.rank === currentRank.rank);
  
  if (currentIndex === 0) {
    return interaction.editReply('❌ Kullanıcı zaten en alt rütbede!');
  }
  
  const prevRole = sortedRoles[currentIndex - 1];
  const result = await robloxAPI.setUserRole(userId, config.groupId, prevRole.id, ROBLOX_COOKIE);
  
  if (result) {
    const embed = new EmbedBuilder()
      .setTitle('⬇️ Tenzil Edildi')
      .setDescription(`**${robloxNick}** tenzil edildi`)
      .addFields(
        { name: '📈 Eski Rütbe', value: currentRank.name, inline: true },
        { name: '📉 Yeni Rütbe', value: prevRole.name, inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply('❌ Tenzil işlemi başarısız!');
  }
}

async function handleBan(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    return interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const discordUserId = interaction.options.getString('kullanici_id');
  
  try {
    const user = await client.users.fetch(discordUserId);
    await interaction.guild.members.ban(discordUserId, { reason: 'Admin komutu ile yasaklandı' });
    
    const embed = new EmbedBuilder()
      .setTitle('🚫 Kullanıcı Yasaklandı')
      .setDescription(`**${user.tag}** Discord sunucusundan yasaklandı`)
      .addFields(
        { name: '👤 Yasaklanan', value: user.tag, inline: true },
        { name: '🆔 Discord ID', value: discordUserId, inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Yasaklama hatası:', error);
    await interaction.editReply('❌ Kullanıcı yasaklanamadı! Kullanıcı ID\'sini kontrol edin veya botun yetkileri eksik olabilir.');
  }
}

async function handleUnban(interaction) {
  if (!interaction.member.roles.cache.has(config.adminRoleId)) {
    return interaction.reply({ content: '❌ Bu komutu kullanma yetkiniz yok!', ephemeral: true });
  }
  
  await interaction.deferReply();
  
  const discordUserId = interaction.options.getString('kullanici_id');
  
  try {
    await interaction.guild.members.unban(discordUserId, 'Admin komutu ile yasak kaldırıldı');
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Yasak Kaldırıldı')
      .setDescription(`Discord ID: **${discordUserId}** olan kullanıcının yasağı kaldırıldı`)
      .addFields(
        { name: '🆔 Discord ID', value: discordUserId, inline: true }
      )
      .setColor(0x00FF00)
      .setTimestamp();
    
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Yasak kaldırma hatası:', error);
    await interaction.editReply('❌ Yasak kaldırılamadı! Kullanıcı ID\'sini kontrol edin veya kullanıcı zaten yasaklı değil.');
  }
}

async function handleActivityQuery(interaction) {
  await interaction.deferReply();
  
  const activity = await robloxAPI.getGameActivity(config.gameId);
  
  if (!activity) {
    return interaction.editReply('❌ Oyun bilgisi alınamadı!');
  }
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Oyun Aktifliği')
    .setDescription(`**${activity.name}** oyun istatistikleri`)
    .addFields(
      { name: '🎮 Şu An Oynayan', value: activity.playing.toString(), inline: true },
      { name: '👥 Maksimum Oyuncu', value: activity.maxPlayers.toString(), inline: true },
      { name: '📈 Toplam Ziyaret', value: activity.visits.toLocaleString(), inline: true }
    )
    .setColor(0x0099FF)
    .setTimestamp();
  
  await interaction.editReply({ embeds: [embed] });
}

client.login(DISCORD_TOKEN);
