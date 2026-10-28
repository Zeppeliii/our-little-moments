import {sameOrderDraft} from './menu-order.js';
import {GitHubStore} from './github-store.js';
import {StoreError} from './memory-model.js';
import {validateMenu,validateDish,validateOrder,menuPhotoPath,isMenuIllustration,ORDER_STATUSES} from './menu-model.js';

const RAW = 'https://raw.githubusercontent.com/Zeppeliii/our-little-moments';
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export class MenuStore extends GitHubStore {
  async read(ref = 'main') {
    if(ref === 'main' && this.token) ref = (await this.request('/git/ref/heads/main')).object.sha;
    let response;
    try { response = await this.fetcher(`${RAW}/${encodeURIComponent(ref)}/menu.json?t=${Date.now()}`,{cache:'no-store'}); }
    catch { throw new StoreError('共享菜单暂时无法读取，请稍后刷新'); }
    if(response.status === 404) return {version:1,dishes:[],orders:[]};
    if(!response.ok) throw new StoreError('共享菜单暂时无法读取，请稍后刷新',response.status);
    let data;
    try { data = await response.json(); } catch { throw new StoreError('共享菜单格式不正确，请稍后刷新'); }
    return validateMenu(data);
  }
  async change(action, value, expectedVersion = null) {
    if(!this.connected) throw new StoreError('共享菜单服务尚未配置完成',503);
    if(!['save-dish','delete-dish','place-order','order-status','rate-dish'].includes(action) || !value || !ID.test(value.id)) throw new StoreError('点单操作不正确，请刷新后重试',400);
    if(expectedVersion !== null && !ID.test(expectedVersion)) throw new StoreError('菜单版本不正确，请刷新后重试',400);
    let prepared = null;
    const photoEntries = [];
    const now = Date.now();
    if(action === 'save-dish') {
      prepared = {id:value.id,name:value.name?.trim(),category:value.category,description:value.description?.trim(),photo:value.photo,createdAt:now,version:this.uuid()};
      validateDish(prepared,true);
      if(prepared.photo && !isMenuIllustration(prepared.photo) && !menuPhotoPath(prepared.photo)) {
        const path = `data/menu-photos/${value.id}/${this.uuid()}.jpg`;
        const blob = await this.request('/git/blobs',{method:'POST',body:{content:prepared.photo.split(',')[1],encoding:'base64'}});
        photoEntries.push({path,mode:'100644',type:'blob',sha:blob.sha});
        prepared.photo = `${RAW}/main/${path}`;
      }
    }
    if(action === 'place-order') {
      if(expectedVersion !== null) throw new StoreError('这份点单已经提交，请刷新查看',409);
      prepared = {id:value.id,mode:value.mode,who:value.who?.trim(),restaurant:value.restaurant?.trim(),items:value.items,note:value.note?.trim(),status:'pending',createdAt:now,version:this.uuid()};
      validateOrder(prepared);
    }
    if(action === 'order-status' && !Object.hasOwn(ORDER_STATUSES,value.status)) throw new StoreError('点单状态不正确',400);
    if(action === 'rate-dish' && (!Number.isFinite(value.rating) || !Number.isInteger(value.rating * 2) || value.rating < 0.5 || value.rating > 5)) throw new StoreError('请选择 0.5–5 星评分，每半星一档',400);
    const version = this.uuid();
    for(let attempt = 0; attempt < 3; attempt++) {
      const ref = await this.request('/git/ref/heads/main');
      const commit = await this.request(`/git/commits/${ref.object.sha}`);
      const data = await this.read(ref.object.sha);
      const isDish = action.endsWith('dish');
      const items = isDish ? data.dishes : data.orders;
      const previous = items.find(item => item.id === value.id);
      if(action === 'place-order' && previous) {
        if(!sameOrderDraft(previous,prepared)) throw new StoreError('上次点单已提交，当前内容与那一单不同。当前修改仍保留，请先查看点单记录，再决定是否另点一单。',409);
        return data;
      }
      if((previous?.version || null) !== expectedVersion) throw new StoreError('这项内容刚被另一边更新，请刷新后再操作',409);
      if(['delete-dish','order-status','rate-dish'].includes(action) && !previous) throw new StoreError('这项内容已经不存在，请刷新',409);
      let next = prepared;
      if(action === 'save-dish') next = {...prepared,rating:previous?.rating || 0,createdAt:previous?.createdAt || now};
      if(action === 'place-order' && next.mode === 'home') {
        next = {...prepared,items:prepared.items.map(item => {
          const dish = data.dishes.find(dish => dish.id === item.dishId);
          if(!dish) throw new StoreError('有道菜已经下架，请刷新菜单后重新选择',409);
          return {dishId:dish.id,name:dish.name,quantity:item.quantity};
        })};
      }
      if(action === 'order-status') next = {...previous,status:value.status,version,updatedAt:now};
      if(action === 'rate-dish') next = {...previous,rating:value.rating,version,updatedAt:now};
      const updated = items.filter(item => item.id !== value.id);
      if(next) updated.push(next);
      const result = {...data,[isDish ? 'dishes' : 'orders']:updated};
      validateMenu(result);
      const removed = menuPhotoPath(previous?.photo) && previous.photo !== next?.photo ? [{path:menuPhotoPath(previous.photo),mode:'100644',type:'blob',sha:null}] : [];
      const tree = await this.request('/git/trees',{method:'POST',body:{base_tree:commit.tree.sha,tree:[...photoEntries,...removed,{path:'menu.json',mode:'100644',type:'blob',content:JSON.stringify(result,null,2)}]}});
      const title = action === 'rate-dish' ? `给${previous.name}评了 ${value.rating} 星` : action === 'save-dish' ? `更新我们的菜谱：${next.name}` : action === 'delete-dish' ? `下架菜谱：${previous.name}` : action === 'place-order' ? `${next.who}提交了一份${next.mode === 'home' ? '在家' : '外出'}点单` : `点单状态：${ORDER_STATUSES[next.status]}`;
      const created = await this.request('/git/commits',{method:'POST',body:{message:title,tree:tree.sha,parents:[ref.object.sha]}});
      try { await this.request('/git/refs/heads/main',{method:'PATCH',body:{sha:created.sha,force:false}}); return result; }
      catch(error) { if(![409,422].includes(error.status) || attempt === 2) throw error; }
    }
  }
}
