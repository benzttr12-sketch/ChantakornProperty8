import { photos } from '@/lib/server/photos';

export const POST = (request: Request) => photos.upload(request);
