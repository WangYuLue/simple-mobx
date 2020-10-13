import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: { c: 1 } });

autorun(() => {
  console.log(store.b.c);
});

store.b.c = 5;