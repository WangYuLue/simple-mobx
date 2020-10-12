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
  console.log(store.c.d)
});

store.c.d = 2;
