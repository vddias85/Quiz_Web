// Lista usada pelo filtro de apelidos (src/lib/nickname.ts).
// As palavras já estão na forma normalizada: minúsculas, sem acento e com letras
// repetidas reduzidas a uma ("porra" → "pora").
//
// SUBSTRING: bloqueadas em qualquer parte do apelido. Só entram palavras longas e
// inequívocas, para não barrar apelidos inocentes.
// TOKEN: bloqueadas só quando são o apelido inteiro ou um pedaço separado por _ ou -
// (ex.: "puta" não pode barrar "computador").

export const BLOCKED_SUBSTRINGS: readonly string[] = [
  // português
  "caralh", "merda", "buceta", "boceta", "foder", "fuder", "fodase", "fodido",
  "arombad", "piroca", "punheta", "siririca", "boquete", "xoxota", "xereca", "cuzao",
  "vagabund", "prostitut", "putaria", "filhodaputa", "fdputa", "viadinho", "escrot",
  "retardad", "estupr", "pedofil", "corno",
  // ódio
  "nazis", "hitler", "kukluxklan",
  // inglês
  "fuck", "shit", "bitch", "whore", "pusy", "dildo",
];

export const BLOCKED_TOKENS: readonly string[] = [
  "pora", "puta", "puto", "cu", "pau", "rola", "pica", "foda", "fdp", "pqp", "vsf", "vtnc", "tnc",
  "krl", "crl", "viado", "veado", "bicha", "piranha", "bosta", "cacete", "otario", "babaca",
  "crioulo", "macaco", "porno", "sexo", "xota", "xana", "tesao", "gozo", "anus", "penis",
  "vagina", "nazi", "dick", "cock", "sex", "niger", "niga", "cunt", "fagot",
];
