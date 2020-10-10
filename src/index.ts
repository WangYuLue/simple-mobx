import { observable, autorun } from './core/mobx';
// import { observable, autorun } from 'mobx';

const store = observable({ a: 1, b: 3 });

autorun(() => {
  console.log(store.a)
});

store.a = 2;