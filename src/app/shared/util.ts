export class Util {
  public static replaceDots(s: string) {
    return s.replace(new RegExp('\\.', 'g'), '-')
  }
}
