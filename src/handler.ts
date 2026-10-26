import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

export interface Config {
  market: string; // e.g. "amazon.nl"
  isbns: string[];
  email: string; // recipient
  senderEmail?: string; // SES-verified sender, defaults to email
  sesRegion?: string;
}

const s3 = new S3Client({});

export async function loadConfig(): Promise<Config> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: process.env.CONFIG_BUCKET,
      Key: process.env.CONFIG_KEY,
    })
  );
  const cfg = JSON.parse((await res.Body!.transformToString()) as string) as Config;
  if (!cfg.market || !Array.isArray(cfg.isbns) || !cfg.email) {
    throw new Error("Config must contain market, isbns[] and email");
  }
  if (!/^(www\.)?amazon\.[a-z.]+$/i.test(cfg.market)) {
    throw new Error(`Invalid market: ${cfg.market}`);
  }
  return cfg;
}

export function isInStock(html: string): boolean {
  if (/id=["']outOfStock["']/i.test(html)) return false;
  if (/currently unavailable|momenteel niet beschikbaar|derzeit nicht verfügbar|actuellement indisponible|non disponibile|no disponible/i.test(html)) {
    return false;
  }
  return /id=["']add-to-cart-button["']|id=["']buy-now-button["']|id=["']availability["'][^>]*>\s*(<span[^>]*>)?\s*(in stock|op voorraad|auf lager|en stock|disponibile|disponible)/i.test(html);
}

export async function checkIsbn(market: string, isbn: string): Promise<boolean> {
  const host = market.replace(/^www\./, "");
  const res = await fetch(`https://www.${host}/dp/${encodeURIComponent(isbn)}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${isbn}`);
  return isInStock(await res.text());
}

export const handler = async () => {
  const cfg = await loadConfig();
  const inStock: string[] = [];
  for (const isbn of cfg.isbns) {
    try {
      if (await checkIsbn(cfg.market, isbn)) inStock.push(isbn);
    } catch (e) {
      console.error(`Failed checking ${isbn}`, e);
    }
  }
  console.log(`In stock: ${JSON.stringify(inStock)}`);
  if (inStock.length === 0) return { inStock };

  const host = cfg.market.replace(/^www\./, "");
  const lines = inStock.map((i) => `https://www.${host}/dp/${i}`);
  const ses = new SESClient({ region: cfg.sesRegion });
  await ses.send(
    new SendEmailCommand({
      Source: cfg.senderEmail ?? cfg.email,
      Destination: { ToAddresses: [cfg.email] },
      Message: {
        Subject: { Data: `Back in stock on ${host}: ${inStock.join(", ")}` },
        Body: { Text: { Data: `These products appear to be in stock:\n\n${lines.join("\n")}` } },
      },
    })
  );
  return { inStock };
};
