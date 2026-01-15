import { ValidatedGlitch } from '@/types';

type Platform = 'twitter' | 'telegram';

export class ContentVariationEngine {
  private emojiSets = [
    ['🚨', '💰', '📉', '⏰', '🔗'],
    ['🔥', '💵', '📊', '⚡', '👆'],
    ['💥', '🤑', '📈', '🏃', '🛒'],
    ['⚠️', '💎', '📉', '⏳', '👀']
  ];

  private templates = {
    twitter: [
      "{emoji1} PRICE GLITCH ALERT!\n\n{title}\n\n💰 NOW: ${price} (Was ${original})\n📉 {discount}% OFF\n\n{emoji3} Act fast - likely a {type}!\n\n🔗 {link}\n\n#PriceGlitch #Deals",
      "{emoji2} CRITICAL PRICE DROP\n\n{title} at {retailer}\n\n💵 ONLY ${price}\n❌ Was ${original}\n\n{emoji4} Hurry before it's fixed!\n\n👉 {link}",
      "{emoji1} {discount}% OFF DETECTED\n\n{retailer} pricing error?\n\n{title}\n💎 ${price} (Reg. ${original})\n\n{emoji5} Grab it here: {link}\n\n#Glitch #Shopping"
    ],
    telegram: [
      "<b>{emoji1} POSSIBLY A PRICE GLITCH!</b>\n\n{title}\n\n💰 <b>Price: ${price}</b>\n❌ <s>Was: ${original}</s>\n📉 <b>Discount: {discount}%</b>\n\n🏪 Store: {retailer}\n❓ Type: {type}\n\n{emoji5} <a href=\"{link}\"><b>CHECK DEAL NOW</b></a>",
      "<b>{emoji2} MASSIVE SAVINGS ALERT</b>\n\n{title}\n\n💵 <b>Now: ${price}</b> (Reg: ${original})\n🔥 <b>Savings: {discount}%</b>\n\n{emoji4} <i>Deals like this expire quickly!</i>\n\n👉 <a href=\"{link}\">Direct Link</a>"
    ]
  };

  generatePost(glitch: ValidatedGlitch, platform: Platform): string {
    const templates = this.templates[platform];
    const template = templates[Math.floor(Math.random() * templates.length)];
    const emojis = this.emojiSets[Math.floor(Math.random() * this.emojiSets.length)];

    const originalPrice = glitch.product.originalPrice || glitch.product.price * (1 + glitch.profitMargin/100);

    return template
      .replace('{emoji1}', emojis[0])
      .replace('{emoji2}', emojis[1])
      .replace('{emoji3}', emojis[2])
      .replace('{emoji4}', emojis[3])
      .replace('{emoji5}', emojis[4])
      .replace('{title}', glitch.product.title)
      .replace('{price}', glitch.product.price.toFixed(2))
      .replace('{original}', originalPrice.toFixed(2))
      .replace('{discount}', Math.round(glitch.profitMargin).toString())
      .replace('{retailer}', glitch.product.retailer)
      .replace('{type}', glitch.glitchType.replace('_', ' '))
      .replace('{link}', glitch.product.url); // Later will be replaced by affiliate link
  }
}
