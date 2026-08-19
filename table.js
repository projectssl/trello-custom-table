const t = window.TrelloPowerUp.iframe();

let cards = [];
let lists = [];
let customFields = [];
let rows = [];

let sortKey = 'name';
let sortDirection = 1;


// -----------------------------------------------------
// START
// -----------------------------------------------------

async function init() {

  try {

    const results = await Promise.all([

      t.board(
        'id',
        'name',
        'customFields'
      ),

      t.cards(
        'id',
        'name',
        'url',
        'idList',
        'labels',
        'members',
        'due',
        'customFieldItems'
      ),

      t.lists(
        'id',
        'name'
      )

    ]);


    const board = results[0] || {};

    cards = results[1] || [];

    lists = results[2] || [];

    customFields =
      board.customFields || [];


    prepareRows();

    buildListFilter();

    buildCustomFilters();

    buildHeaders();

    bindEvents();

    render();


    document
      .getElementById('loading')
      .classList
      .add('hidden');


    document
      .getElementById('app')
      .classList
      .remove('hidden');


  } catch (error) {

    showError(error);

  }

}


// -----------------------------------------------------
// PREPARE DATA
// -----------------------------------------------------

function prepareRows() {

  const listMap = {};


  lists.forEach(function (list) {

    listMap[list.id] =
      list.name;

  });


  rows = cards.map(function (card) {

    const row = {

      id: card.id,

      name:
        card.name || '',

      url:
        card.url || '',

      list:
        listMap[card.idList] || '',

      labels:
        (card.labels || [])
          .map(function (label) {
            return label.name || '';
          })
          .filter(Boolean),

      members:
        (card.members || [])
          .map(function (member) {

            return (
              member.fullName ||
              member.username ||
              ''
            );

          })
          .filter(Boolean),

      due:
        card.due || '',

      custom: {}

    };


    customFields.forEach(
      function (field) {

        row.custom[field.id] =
          getCustomFieldValue(
            field,
            card.customFieldItems || []
          );

      }
    );


    return row;

  });

}


// -----------------------------------------------------
// CUSTOM FIELD VALUES
// -----------------------------------------------------

function getCustomFieldValue(
  field,
  items
) {

  const item =
    items.find(
      function (item) {

        return (
          item.idCustomField === field.id
        );

      }
    );


  if (!item) {
    return '';
  }


  // DROPDOWN

  if (field.type === 'list') {

    const option =
      (field.options || [])
        .find(
          function (option) {

            return (
              option.id === item.idValue
            );

          }
        );


    if (
      option &&
      option.value
    ) {

      return (
        option.value.text || ''
      );

    }


    return '';

  }


  // CHECKBOX

  if (field.type === 'checkbox') {

    if (!item.value) {
      return '';
    }


    return (
      item.value.checked === 'true'
    )
      ? 'Yes'
      : 'No';

  }


  // TEXT

  if (
    field.type === 'text' &&
    item.value
  ) {

    return (
      item.value.text || ''
    );

  }


  // NUMBER

  if (
    field.type === 'number' &&
    item.value
  ) {

    return (
      item.value.number ?? ''
    );

  }


  // DATE

  if (
    field.type === 'date' &&
    item.value
  ) {

    return (
      item.value.date || ''
    );

  }


  return '';

}


// -----------------------------------------------------
// LIST FILTER
// -----------------------------------------------------

function buildListFilter() {

  const select =
    document.getElementById(
      'listFilter'
    );


  lists
    .slice()
    .sort(
      function (a, b) {

        return a.name.localeCompare(
          b.name
        );

      }
    )
    .forEach(
      function (list) {

        const option =
          document.createElement(
            'option'
          );


        option.value =
          list.name;


        option.textContent =
          list.name;


        select.appendChild(
          option
        );

      }
    );

}


// -----------------------------------------------------
// CUSTOM FIELD FILTERS
// -----------------------------------------------------

function buildCustomFilters() {

  const container =
    document.getElementById(
      'customFilters'
    );


  container.innerHTML = '';


  customFields.forEach(
    function (field) {

      const select =
        document.createElement(
          'select'
        );


      select.className =
        'custom-filter';


      select.dataset.fieldId =
        field.id;


      const first =
        document.createElement(
          'option'
        );


      first.value = '';


      first.textContent =
        'All ' + field.name;


      select.appendChild(first);


      const values =
        new Set();


      rows.forEach(
        function (row) {

          const value =
            row.custom[field.id];


          if (
            value !== '' &&
            value !== null &&
            value !== undefined
          ) {

            values.add(
              String(value)
            );

          }

        }
      );


      Array
        .from(values)
        .sort(
          function (a, b) {

            return a.localeCompare(
              b,
              undefined,
              {
                numeric: true,
                sensitivity: 'base'
              }
            );

          }
        )
        .forEach(
          function (value) {

            const option =
              document.createElement(
                'option'
              );


            option.value =
              value;


            option.textContent =
              value;


            select.appendChild(
              option
            );

          }
        );


      container.appendChild(
        select
      );

    }
  );

}


// -----------------------------------------------------
// TABLE HEADERS
// -----------------------------------------------------

function buildHeaders() {

  const header =
    document.getElementById(
      'header'
    );


  header.innerHTML = '';


  const columns = [

    {
      key: 'name',
      label: 'Card'
    },

    {
      key: 'list',
      label: 'List'
    },

    {
      key: 'labels',
      label: 'Labels'
    },

    {
      key: 'members',
      label: 'Members'
    },

    {
      key: 'due',
      label: 'Due Date'
    }

  ];


  customFields.forEach(
    function (field) {

      columns.push({

        key:
          'custom:' + field.id,

        label:
          field.name

      });

    }
  );


  columns.forEach(
    function (column) {

      const th =
        document.createElement(
          'th'
        );


      th.dataset.key =
        column.key;


      th.dataset.label =
        column.label;


      th.addEventListener(
        'click',
        function () {

          changeSort(
            column.key
          );

        }
      );


      header.appendChild(
        th
      );

    }
  );


  refreshHeaders();

}


// -----------------------------------------------------
// SORTING
// -----------------------------------------------------

function changeSort(key) {

  if (sortKey === key) {

    sortDirection *= -1;

  } else {

    sortKey = key;

    sortDirection = 1;

  }


  refreshHeaders();

  render();

}


function refreshHeaders() {

  document
    .querySelectorAll(
      '#header th'
    )
    .forEach(
      function (th) {

        let text =
          th.dataset.label;


        if (
          th.dataset.key ===
          sortKey
        ) {

          text +=
            sortDirection === 1
              ? ' ▲'
              : ' ▼';

        }


        th.textContent =
          text;

      }
    );

}


// -----------------------------------------------------
// FILTERING
// -----------------------------------------------------

function getVisibleRows() {

  const search =
    document
      .getElementById(
        'searchInput'
      )
      .value
      .trim()
      .toLowerCase();


  const selectedList =
    document
      .getElementById(
        'listFilter'
      )
      .value;


  const fieldFilters =
    document.querySelectorAll(
      '.custom-filter'
    );


  const filtered =
    rows.filter(
      function (row) {


        // LIST FILTER

        if (
          selectedList &&
          row.list !== selectedList
        ) {

          return false;

        }


        // SEARCH

        if (search) {

          const searchText = [

            row.name,

            row.list,

            row.labels.join(' '),

            row.members.join(' '),

            ...Object.values(
              row.custom
            )

          ]
            .join(' ')
            .toLowerCase();


          if (
            !searchText.includes(
              search
            )
          ) {

            return false;

          }

        }


        // CUSTOM FIELD FILTERS

        for (
          const filter
          of fieldFilters
        ) {

          if (
            !filter.value
          ) {

            continue;

          }


          const fieldId =
            filter.dataset.fieldId;


          const rowValue =
            String(
              row.custom[fieldId] ?? ''
            );


          if (
            rowValue !== filter.value
          ) {

            return false;

          }

        }


        return true;

      }
    );


  // SORT

  filtered.sort(
    function (a, b) {

      const aValue =
        getSortValue(
          a,
          sortKey
        );


      const bValue =
        getSortValue(
          b,
          sortKey
        );


      return (
        String(aValue)
          .localeCompare(
            String(bValue),
            undefined,
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
        *
        sortDirection
      );

    }
  );


  return filtered;

}


// -----------------------------------------------------
// SORT VALUE
// -----------------------------------------------------

function getSortValue(
  row,
  key
) {

  if (
    key.startsWith(
      'custom:'
    )
  ) {

    const fieldId =
      key.substring(7);


    return (
      row.custom[fieldId] ?? ''
    );

  }


  if (
    Array.isArray(
      row[key]
    )
  ) {

    return (
      row[key].join(' ')
    );

  }


  return (
    row[key] ?? ''
  );

}


// -----------------------------------------------------
// RENDER TABLE
// -----------------------------------------------------

function render() {

  const visible =
    getVisibleRows();


  const tbody =
    document.getElementById(
      'body'
    );


  tbody.innerHTML = '';


  if (!visible.length) {

    const tr =
      document.createElement(
        'tr'
      );


    const td =
      document.createElement(
        'td'
      );


    td.colSpan =
      5 + customFields.length;


    td.textContent =
      'No cards match the current filters.';


    td.style.padding =
      '30px';


    td.style.textAlign =
      'center';


    tr.appendChild(td);

    tbody.appendChild(tr);

  }


  visible.forEach(
    function (row) {

      const tr =
        document.createElement(
          'tr'
        );


      // CARD

      const cardCell =
        document.createElement(
          'td'
        );


      const link =
        document.createElement(
          'a'
        );


      link.className =
        'card-link';


      link.href =
        row.url;


      link.target =
        '_blank';


      link.rel =
        'noopener noreferrer';


      link.textContent =
        row.name;


      cardCell.appendChild(
        link
      );


      tr.appendChild(
        cardCell
      );


      // LIST

      addCell(
        tr,
        row.list
      );


      // LABELS

      const labelCell =
        document.createElement(
          'td'
        );


      row.labels.forEach(
        function (label) {

          const span =
            document.createElement(
              'span'
            );


          span.className =
            'label';


          span.textContent =
            label;


          labelCell.appendChild(
            span
          );

        }
      );


      tr.appendChild(
        labelCell
      );


      // MEMBERS

      addCell(
        tr,
        row.members.join(', ')
      );


      // DUE DATE

      addCell(
        tr,
        formatDate(
          row.due
        )
      );


      // CUSTOM FIELDS

      customFields.forEach(
        function (field) {

          let value =
            row.custom[field.id];


          if (
            field.type === 'date'
          ) {

            value =
              formatDate(
                value
              );

          }


          addCell(
            tr,
            value
          );

        }
      );


      tbody.appendChild(
        tr
      );

    }
  );


  document
    .getElementById(
      'count'
    )
    .textContent =
      visible.length +
      (
        visible.length === 1
          ? ' card'
          : ' cards'
      );

}


// -----------------------------------------------------
// HELPERS
// -----------------------------------------------------

function addCell(
  row,
  value
) {

  const td =
    document.createElement(
      'td'
    );


  td.textContent =
    value ?? '';


  row.appendChild(
    td
  );

}


function formatDate(value) {

  if (!value) {
    return '';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return value;

  }


  return date.toLocaleDateString(
    undefined,
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  );

}


// -----------------------------------------------------
// EVENTS
// -----------------------------------------------------

function bindEvents() {

  document
    .getElementById(
      'searchInput'
    )
    .addEventListener(
      'input',
      render
    );


  document
    .getElementById(
      'listFilter'
    )
    .addEventListener(
      'change',
      render
    );


  document
    .querySelectorAll(
      '.custom-filter'
    )
    .forEach(
      function (select) {

        select.addEventListener(
          'change',
          render
        );

      }
    );


  document
    .getElementById(
      'clearButton'
    )
    .addEventListener(
      'click',
      function () {

        document
          .getElementById(
            'searchInput'
          )
          .value = '';


        document
          .getElementById(
            'listFilter'
          )
          .value = '';


        document
          .querySelectorAll(
            '.custom-filter'
          )
          .forEach(
            function (select) {

              select.value = '';

            }
          );


        render();

      }
    );

}


// -----------------------------------------------------
// ERROR DISPLAY
// -----------------------------------------------------

function showError(error) {

  console.error(error);


  document
    .getElementById(
      'loading'
    )
    .innerHTML =
      '<strong>Custom Table could not load.</strong>' +
      '<br><br>' +
      escapeHtml(
        error &&
        error.message
          ? error.message
          : String(error)
      );

}


function escapeHtml(value) {

  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


// -----------------------------------------------------
// RUN
// -----------------------------------------------------

init();
