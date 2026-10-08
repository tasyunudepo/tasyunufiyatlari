/** Ortak, saf telefon normalizasyonu; mevcut teklif guard'ının sözleşmesi. */
export function normalizePhoneDigits(rawPhone:string):string|null {
 const raw=rawPhone.trim(),international=raw.startsWith('+')||raw.startsWith('00');
 let digits=raw.replace(/\D/g,'');
 if(digits.startsWith('00'))digits=digits.slice(2);
 if(!international&&digits.length===11&&digits.startsWith('0'))digits='90'+digits.slice(1);
 else if(!international&&digits.length===10)digits='90'+digits;
 return digits.length>=10&&digits.length<=15?digits:null;
}
export function contactTargets(raw:string,message:string){
 const digits=normalizePhoneDigits(raw);
 const valid=digits&&/^[1-9]\d{9,14}$/.test(digits)&&/^[+\d\s().-]+$/.test(raw.trim())
  &&(!digits.startsWith('90')||/^90[2-5]\d{9}$/.test(digits));
 return valid?{e164:'+'+digits,tel:'tel:+'+digits,whatsapp:`https://wa.me/${digits}?text=${encodeURIComponent(message)}`} : null;
}
