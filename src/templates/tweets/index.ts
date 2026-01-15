export interface TweetTemplateVariables {
  productName: string;
  price: string;
  originalPrice: string;
  discountPercent: string;
  savings: string;
  link: string;
}

export const TWEET_TEMPLATES = [
  "🚨 PRICE GLITCH: {productName} is {discountPercent}% OFF! Now ${price} (was ${originalPrice}). 🏃‍♂️💨\n\nAnalyst Source: {link}",
  "🔥 STEAL ALERT: {productName} dropped to ${price}! That's a ${savings} savings! 📉\n\nLink: {link}",
  "⚠️ HUGE DROP: {productName} for only ${price} ({discountPercent}% Off)! 🚩\n\nGrab it here: {link}",
  "⚡ FLASH DEAL: {productName} - Was ${originalPrice}, Now ${price}! 💸\n\nDon't miss out: {link}",
  "📉 PRICE CRASH: {productName} is down {discountPercent}%! Only ${price} right now. 🤯\n\nDetails: {link}",
  "🔎 SPOTTED: {productName} Glitch? ${price} (MSRP ${originalPrice}). 🤑\n\nCheck it out: {link}",
];

export function formatTweet(template: string, vars: TweetTemplateVariables): string {
  return template
    .replace('{productName}', vars.productName)
    .replace('{price}', vars.price)
    .replace('{originalPrice}', vars.originalPrice)
    .replace('{discountPercent}', vars.discountPercent)
    .replace('{savings}', vars.savings)
    .replace('{link}', vars.link);
}

export function getRandomTemplate(): string {
  return TWEET_TEMPLATES[Math.floor(Math.random() * TWEET_TEMPLATES.length)];
}
