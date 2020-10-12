import { observable, autorun } from './core/mobx';
// import { observable, autorun } from 'mobx';

const store = observable(
  {
    a: 1,
    b: 3,
    c: {
      d: 1
    }
  }
);

autorun(() => {
  console.log(store.a);

  // if (store.a === 1) {
  //   console.log(store.b)
  // } else {
  //   console.log(store.c.d)
  // }
});

store.a = 2;
store.c.d = 10