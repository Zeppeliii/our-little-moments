import {WORKER_URL} from './site-config.js?v=netlify-1';
const PHOTO = /^https:\/\/raw\.githubusercontent\.com\/Zeppeliii\/our-little-moments\/main\/data\/(?:photos|menu-photos)\/[a-f0-9-]+\/[a-f0-9-]+\.jpg$/;
export function previewPhoto(photo,width = 640) {
  if(!PHOTO.test(photo)) return photo;
  return `${WORKER_URL}/.netlify/images?url=${encodeURIComponent(photo)}&w=${width}&q=75`;
}
export function restoreOriginalPhoto(event) {
  const image = event.target;
  if(image.tagName === 'IMG' && image.dataset.original) {
    const original = image.dataset.original; delete image.dataset.original; image.src = original;
  }
}
