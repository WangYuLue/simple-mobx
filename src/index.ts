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
  console.log('===>1');

  console.log(store.c.d)
});
autorun(() => {
  console.log('===>2');
  console.log(store.b)
});


store.b = 10;
store.c.d = 2;
