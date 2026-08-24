# leelainfra.in — WhatsApp Sender

Simple Node.js + Express app to send WhatsApp messages (template, plain text, media) via **Meta's WhatsApp Cloud API** directly (no third-party BSP markup), from your business's WhatsApp number.

## Setup

1. **Meta WhatsApp Cloud API onboard karo:**
   - [developers.facebook.com](https://developers.facebook.com) par ek account/app banao (App type: **Business**).
   - App me **WhatsApp** product add karo.
   - "API Setup" page se **test phone number** milta hai turant testing ke liye (kuch fixed test numbers ko free me msg bhej sakte ho).
   - Real production ke liye: apna business WhatsApp number Meta Business Manager me verify/add karo (leelainfra.in ke naam se business verification bhi karni hogi).
   - Kam se kam ek message **template** banao (WhatsApp Manager -> Message Templates) aur Meta se approve karwao — naye/cold numbers ko pehli baar likhne ke liye zaroori hai.
   - **Access Token**: shuru me temporary token milta hai (24hr expire). Production ke liye Meta Business Manager -> System Users me ek System User banake **permanent access token** generate karo (`whatsapp_business_messaging` permission ke saath).
   - **Phone Number ID**: App -> WhatsApp -> API Setup page par milta hai (ye asli phone number nahi, ek internal ID hai).

2. **Project setup:**
   ```bash
   npm install
   cp .env.example .env
   ```
   `.env` file me `WHATSAPP_ACCESS_TOKEN` aur `WHATSAPP_PHONE_NUMBER_ID` daal do.

3. **Run:**
   ```bash
   npm start
   ```
   Browser me kholo: http://localhost:3000

## Teen message types

- **Template Message** — kisi ko bhi (cold/naye number) bhej sakte ho, par template pehle Meta se approved hona chahiye. Language code Meta ke format me do (jaise `en_US`, `hi`).
- **Text Message** — sirf un numbers ko jinhone last 24 ghante ke andar aapko WhatsApp par message kiya ho (session window). Isse bahar deliver nahi hoga.
- **Media Message** (image/document/video/audio) — same 24-hour session rule. File upload karo ya public URL do.

Sabhi teeno tabs me numbers **bulk** me diye ja sakte hain — textarea me paste karo (ek line ek number, ya comma se alag) ya CSV/txt file upload karo. Cloud API me ek baar me sirf ek recipient ko message jaata hai, isliye backend har number ke liye alag call karta hai (chhoti si delay ke saath taaki rate limit na lage).

## Important: media file upload aur localhost

Media tab me jab tum file upload karte ho, server usse `public/uploads/` me save karke ek public URL banata hai. **Meta ke servers ko wo URL internet se access karna padta hai** — isliye ye sirf tab kaam karega jab app **deploy** ho (Vercel wagera par), localhost par nahi. Local testing ke liye media URL field me kisi already-public image/file ka link paste kar sakte ho.

## Rate limits / messaging tiers

Naye WhatsApp number ki messaging limit shuru me kam hoti hai (250 unique recipients/24hrs), aur jaise-jaise aap achhi quality se messages bhejte ho, Meta automatically limit badhata hai (1K -> 10K -> 100K/day). Bahut zyada numbers ek saath bhejne se pehle apne current tier ka dhyan rakhna.

## Deploy (Vercel)

```bash
vercel
```
Deploy karne ke baad Vercel dashboard/CLI se `WHATSAPP_ACCESS_TOKEN` aur `WHATSAPP_PHONE_NUMBER_ID` environment variables set karna mat bhoolna. Note: Vercel ka filesystem ephemeral hai, isliye production me media upload ke liye Vercel Blob jaisi persistent storage use karna better hoga (abhi ke `public/uploads` wala tareeka sirf dev/demo ke liye hai).
