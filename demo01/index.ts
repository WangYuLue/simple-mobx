import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: 2 });

autorun(() => {
  console.log(store.a);
});

store.a = 5;