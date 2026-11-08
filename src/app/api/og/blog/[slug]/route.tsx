import { ImageResponse } from 'next/og';
import { getArticle } from '@/lib/blog/heycatch';
import { vehicleFor, vehicleSrc } from '@/lib/blog/visuals';

/**
 * Картинка статьи для соцсетей и поиска (og:image, 1200×630): заголовок
 * статьи и машина по теме на фирменном фоне — та же, что обложка на сайте.
 * HeyCatch своих картинок не присылает; пришлёт — страница возьмёт их.
 */
export const revalidate = 3600;

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(decodeURIComponent(slug));
  const title = article?.title ?? 'RAHTIS';
  const vehicle = vehicleFor(article ?? { slug, title });
  const origin = new URL(request.url).origin;
  const truck = `${origin}${vehicleSrc(vehicle, 'png')}`;
  const kippi = vehicle.file === 'kippiauto';

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: 'linear-gradient(160deg, #e8f3f7 0%, #ffffff 60%, #d9eef6 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 28,
          fontWeight: 700,
          color: '#0d647f',
          letterSpacing: 2,
        }}
      >
        RAHTIS · BLOG
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: title.length > 60 ? 50 : 60,
          fontWeight: 700,
          lineHeight: 1.1,
          color: '#0c1626',
          maxWidth: 1000,
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: kippi ? 'flex-end' : 'center',
          alignItems: 'flex-end',
          height: 220,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- satori рисует только <img> */}
        <img src={truck} alt="" style={{ height: kippi ? 220 : 200, objectFit: 'contain' }} />
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
