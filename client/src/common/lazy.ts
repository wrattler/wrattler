class AsyncLazy<T> {
  
  func: () => Promise<T>
  evaluated: boolean
  value: T | null

  constructor(f:() => Promise<T>) {
    this.func = f;
    this.value = null;
    this.evaluated = false;
  }
  
  async getValue() : Promise<T> {
    if (!this.evaluated) {
      this.value = await this.func();
      this.evaluated = true;
    }
    return <T>this.value;
  }
}

export { AsyncLazy }