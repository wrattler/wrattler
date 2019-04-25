class AsyncLazy<T> {
  
  func: () => Promise<T>
  evaluated: boolean
  value: T

  constructor(f:() => Promise<T>) {
    this.func = f;
    this.evaluated = false;
  }
  
  async getValue() : Promise<T> {
    if (!this.evaluated) {
      this.value = await this.func();
      this.evaluated = true;
    }
    return this.value;
  }
}

export { AsyncLazy }