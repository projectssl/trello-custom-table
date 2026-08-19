const APP_KEY = '78651826f258d356d204ddf1de96f427';
const APP_NAME = 'Custom Table View';

window.TrelloPowerUp.initialize(
  {
    'board-buttons': function (t) {
      return [{
        text: 'Custom Table',
        callback: function (t) {
          return t.modal({
            url: './table.html',
            title: 'Custom Table',
            fullscreen: true
          });
        }
      }];
    }
  },
  {
    appKey: APP_KEY,
    appName: APP_NAME
  }
);
