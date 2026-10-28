import {StoreError} from './memory-model.js';

export const MENU_CATEGORIES = ['荤菜','素菜','主食','汤羹','小吃甜品','零食','酒水饮品'];
export const ORDER_STATUSES = {pending:'等你来安排',accepted:'安排上了',completed:'吃过啦',cancelled:'已取消'};
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const PHOTO_PREFIX = 'https://raw.githubusercontent.com/Zeppeliii/our-little-moments/main/';
const PHOTO_PATH = /^data\/menu-photos\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.jpg$/;
const DATA_PHOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const text = (value,max,required = false) => typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
export function menuPhotoPath(photo) { return typeof photo === 'string' && photo.startsWith(PHOTO_PREFIX) && PHOTO_PATH.test(photo.slice(PHOTO_PREFIX.length)) ? photo.slice(PHOTO_PREFIX.length) : null; }
export const isMenuIllustration = photo => typeof photo === 'string' && /^menu-art\/[a-z0-9-]+\.svg$/.test(photo);
export function validateDish(dish, draft = false) {
  if (!dish || !ID.test(dish.id) || !text(dish.name,60,true) || !MENU_CATEGORIES.includes(dish.category) || !text(dish.description,500) || (dish.rating !== undefined && (!Number.isFinite(dish.rating) || !Number.isInteger(dish.rating * 2) || dish.rating < 0 || dish.rating > 5)) || typeof dish.photo !== 'string' || (dish.photo && !isMenuIllustration(dish.photo) && !menuPhotoPath(dish.photo)?.startsWith(`data/menu-photos/${dish.id}/`) && !(draft && DATA_PHOTO.test(dish.photo) && dish.photo.length < 4*1024*1024))) throw new StoreError('请检查菜名、分类和照片，每道菜的介绍最多 500 字',400);
  return dish;
}
export function validateOrder(order) {
  if (!order || !ID.test(order.id) || !['home','outside'].includes(order.mode) || !text(order.who,30,true) || !text(order.restaurant,80,order.mode === 'outside') || !text(order.note,500) || !Object.hasOwn(ORDER_STATUSES,order.status) || !Array.isArray(order.items) || !order.items.length || order.items.length > 30 || !order.items.every(item => item && (item.dishId === null || ID.test(item.dishId)) && text(item.name,60,true) && Number.isInteger(item.quantity) && item.quantity >= 1 && item.quantity <= 20 && (order.mode !== 'home' || item.dishId !== null))) throw new StoreError('请填写点单人、想吃的内容，并检查份数（每道 1–20 份）',400);
  return order;
}
export function validateMenu(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.dishes) || !Array.isArray(data.orders)) throw new StoreError('共享菜单格式不正确，请稍后刷新',502);
  const ids = new Set();
  for (const [items,check] of [[data.dishes,validateDish],[data.orders,validateOrder]]) {
    for (const item of items) {
      check(item);
      if (!ID.test(item.version) || !Number.isFinite(item.createdAt) || ids.has(item.id)) throw new StoreError('共享菜单格式不正确，请稍后刷新',502);
      ids.add(item.id);
    }
  }
  return data;
}
