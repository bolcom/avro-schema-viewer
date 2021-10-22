export class Util {
  public static replaceDots(s: string) {
    return s.replace(new RegExp('\\.', 'g'), '-')
  }

  public static isNullOrUndefined(o: any): boolean {
    return o == null
  }

  public static isEmpty(obj: object | Array<any>): boolean {
    // @ts-ignore
    return [Object, Array].includes((obj || {}).constructor) && !Object.entries((obj || {})).length;
  }

  public static isObject(value: any): boolean {
    const type = typeof value
    return type === 'function' || type === 'object' && !Array.isArray(value) && !!value
  }

  public static copyString(value: string): string {
    return value.slice()
  }

  public static deepCopy(value: object): object {
    return JSON.parse(JSON.stringify(value))
  }
}
