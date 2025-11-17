const fs = require('fs');

// index.js dosyasını oku
let content = fs.readFileSync('index.js', 'utf8');

// Tüm '> mesaj' formatındaki mesajları '```diff\n- mesaj\n```' formatına çevir
// editReply ve reply içindeki mesajlar
const patterns = [
  // editReply('> mesaj') formatı
  {
    regex: /editReply\('> ([^']+)'\)/g,
    replacement: (match, msg) => {
      // Eğer hata/olumsuz mesaj ise kırmızı (-), aksi halde yeşil (+)
      const isError = msg.includes('değil') || msg.includes('değiştiremezsin') || 
                      msg.includes('bulunamadı') || msg.includes('alınamadı') ||
                      msg.includes('yapamaz') || msg.includes('gerek') || 
                      msg.includes('tanımlanmamış') || msg.includes('olmayan');
      const prefix = isError ? '-' : '+';
      return `editReply('\`\`\`diff\\n${prefix} ${msg}\\n\`\`\`')`;
    }
  },
  // editReply(`> mesaj ${variable}`) formatı
  {
    regex: /editReply\(`> ([^`]+)`\)/g,
    replacement: (match, msg) => {
      // Template literal içindeki değişkenleri koru
      const isError = msg.includes('değil') || msg.includes('değiştiremezsin') || 
                      msg.includes('bulunamadı') || msg.includes('alınamadı') ||
                      msg.includes('yapamaz') || msg.includes('gerek') || 
                      msg.includes('tanımlanmamış') || msg.includes('olmayan');
      const prefix = isError ? '-' : '+';
      return `editReply(\`\\\`\\\`\\\`diff\\n${prefix} ${msg}\\n\\\`\\\`\\\`\`)`;
    }
  },
  // reply({ content: '> mesaj' }) formatı
  {
    regex: /content: '> ([^']+)'/g,
    replacement: (match, msg) => {
      const isError = msg.includes('değil') || msg.includes('bulunamadı') || 
                      msg.includes('alınamadı') || msg.includes('oluştu');
      const prefix = isError ? '-' : '+';
      return `content: '\`\`\`diff\\n${prefix} ${msg}\\n\`\`\`'`;
    }
  },
  // message: '> mesaj' formatı (checkRankPermissions içinde)
  {
    regex: /message: '> ([^']+)'/g,
    replacement: (match, msg) => {
      const prefix = '-'; // Hep hata mesajları
      return `message: '\`\`\`diff\\n${prefix} ${msg}\\n\`\`\`'`;
    }
  }
];

// Tüm pattern'leri uygula
patterns.forEach(({ regex, replacement }) => {
  content = content.replace(regex, replacement);
});

// Değişiklikleri kaydet
fs.writeFileSync('index.js', content, 'utf8');

console.log('✅ Tüm mesajlar yeşil/kırmızı kutu formatına çevrildi!');
