const APP_KEY = '78651826f258d356d204ddf1de96f427';
const APP_NAME = 'Detailed Table View';

window.TrelloPowerUp.initialize(
  {
    'board-buttons': function (t) {
      return [{
        text: 'Detailed Table',

        callback: function (t) {
          return t.modal({
            url: './table.html',
            title: 'Detailed Table',
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
