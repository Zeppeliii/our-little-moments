// 重试只确认同一份点单，不能把修改后的草稿当作旧订单清空。
export function sameOrderDraft(left, right) {
  if(!left || !right) return false;
  const content = order => JSON.stringify({
    mode:order.mode,who:order.who,restaurant:order.restaurant,note:order.note,
    items:order.items.map(item => [order.mode === 'home' ? item.dishId : item.name,item.quantity]).sort((a,b) => String(a[0]).localeCompare(String(b[0])))
  });
  return content(left) === content(right);
}
