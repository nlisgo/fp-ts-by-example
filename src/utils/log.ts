// eslint-disable-next-line no-console
export const log = <T>(m: string | number) => (v: T): void => console.log(m, v);
