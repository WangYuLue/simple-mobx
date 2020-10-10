import { observable, autorun } from './mobx';

const store = observable({ a: 1, b: 3 });

autorun(() => {
  console.log(store.a)
});

store.a = 2;
store.a = 3;
store.a = 4;

// console.log(store);
