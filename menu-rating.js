// 星星立即反馈；保存串行执行，快速改分只发送最新选择。
export class RatingSaver {
  constructor({getDish,send,accept,onUpdate,onError}) {
    Object.assign(this,{getDish,send,accept,onUpdate,onError});
    this.choices = new Map(); this.timer = null; this.running = null;
  }
  get pending() { return this.choices.size > 0; }
  score(dish) { return this.choices.get(dish.id)?.rating ?? dish.rating ?? 0; }
  set(id,rating) {
    const dish = this.getDish(id);
    if(!dish || !Number.isInteger(rating*2) || rating < .5 || rating > 5 || this.score(dish) === rating) return false;
    this.choices.set(id,{rating}); this.onUpdate();
    clearTimeout(this.timer); this.timer = setTimeout(()=>this.flush(),300);
    return true;
  }
  flush() {
    clearTimeout(this.timer);
    if(this.running) return this.running;
    this.running = this.drain().finally(()=>{ this.running = null; });
    return this.running;
  }
  async drain() {
    while(this.choices.size) {
      const [id,choice] = this.choices.entries().next().value;
      const dish = this.getDish(id);
      if(!dish || dish.rating === choice.rating) { this.choices.delete(id); this.onUpdate(); continue; }
      try {
        const result = await this.send(id,choice.rating,dish.version);
        this.accept(result);
        if(this.choices.get(id) === choice) this.choices.delete(id);
        this.onUpdate();
      } catch(error) {
        this.choices.delete(id); this.onUpdate(); this.onError(error);
      }
    }
  }
}
