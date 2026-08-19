const t = window.TrelloPowerUp.iframe();

let cards = [];
let lists = [];
let customFields = [];
let rows = [];

let baselineStartField = null;
let baselineFinishField = null;
let responsibleField = null;

let sortKey = 'name';
let sortDirection = 1;


// =====================================================
// START
// =====================================================

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
        'start',
        'due',
        'dueComplete',
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


    identifyImportantFields();

    prepareRows();

    buildListFilter();

    buildLabelFilter();

    buildMemberFilter();

    buildCustomFilters();

    buildHeaders();

    bindEvents();

    render();


    document
      .getElementById('loading')
      .hidden = true;


    document
      .getElementById('toolbar')
      .hidden = false;


    document
      .getElementById('tableWrap')
      .hidden = false;


  } catch (error) {

    showError(error);

  }

}


// =====================================================
// IDENTIFY IMPORTANT CUSTOM FIELDS
// =====================================================

function identifyImportantFields() {

  baselineStartField =
    findCustomField(
      'Baseline Start'
    );


  baselineFinishField =
    findCustomField(
      'Baseline Finish'
    );


  responsibleField =
    findCustomField(
      'Responsible'
    );

}


function findCustomField(name) {

  const wanted =
    normalise(name);


  return customFields.find(
    function (field) {

      return (
        normalise(field.name) ===
        wanted
      );

    }
  ) || null;

}


function normalise(value) {

  return String(value || '')
    .trim()
    .toLowerCase();

}


// =====================================================
// PREPARE ROWS
// =====================================================

function prepareRows() {

  const listMap = {};


  lists.forEach(
    function (list) {

      listMap[list.id] =
        list.name;

    }
  );


  rows = cards.map(
    function (card) {

      const custom = {};


      customFields.forEach(
        function (field) {

          custom[field.id] =
            getCustomFieldValue(
              field,
              card.customFieldItems || []
            );

        }
      );


      const dueDate =
        card.due || '';


      const baselineStart =
        baselineStartField
          ? custom[baselineStartField.id]
          : '';


      const baselineFinish =
        baselineFinishField
          ? custom[baselineFinishField.id]
          : '';


      const schedule =
        calculateScheduleStatus(
          baselineFinish,
          dueDate
        );


      return {

        id:
          card.id,

        name:
          card.name || '',

        url:
          card.url || '',

        list:
          listMap[card.idList] || '',

        labels:
          (card.labels || [])
            .map(
              function (label) {

                return {

                  id:
                    label.id || '',

                  name:
                    label.name || '',

                  color:
                    label.color || ''

                };

              }
            ),

        members:
          (card.members || [])
            .map(
              prepareMember
            ),

        start:
          card.start || '',

        due:
          dueDate,

        dueComplete:
          Boolean(card.dueComplete),

        custom:
          custom,

        baselineStart:
          baselineStart,

        baselineFinish:
          baselineFinish,

        responsible:
          responsibleField
            ? custom[responsibleField.id]
            : '',

        scheduleStatus:
          schedule.status,

        varianceDays:
          schedule.varianceDays,

        atRisk:
          schedule.status ===
          'At Risk'

      };

    }
  );

}


// =====================================================
// MEMBERS / AVATARS
// =====================================================

function prepareMember(member) {

  const fullName =
    member.fullName ||
    member.username ||
    'Member';


  return {

    id:
      member.id || '',

    fullName:
      fullName,

    username:
      member.username || '',

    initials:
      member.initials ||
      createInitials(fullName),

    avatar:
      getAvatarUrl(member)

  };

}


function getAvatarUrl(member) {

  if (member.avatarUrl) {

    return member.avatarUrl;

  }


  if (member.avatar) {

    return member.avatar;

  }


  if (
    member.id &&
    member.avatarHash
  ) {

    return (
      'https://trello-members.s3.amazonaws.com/' +
      member.id +
      '/' +
      member.avatarHash +
      '/50.png'
    );

  }


  return '';

}


function createInitials(name) {

  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      function (part) {

        return part.charAt(0);

      }
    )
    .join('')
    .toUpperCase();

}


// =====================================================
// CUSTOM FIELD VALUES
// =====================================================

function getCustomFieldValue(
  field,
  items
) {

  const item =
    items.find(
      function (item) {

        return (
          item.idCustomField ===
          field.id
        );

      }
    );


  if (!item) {

    return '';

  }


  if (field.type === 'list') {

    const option =
      (field.options || [])
        .find(
          function (option) {

            return (
              option.id ===
              item.idValue
            );

          }
        );


    return (
      option &&
      option.value
    )
      ? option.value.text || ''
      : '';

  }


  if (field.type === 'checkbox') {

    return (
      item.value &&
      item.value.checked === 'true'
    )
      ? 'Yes'
      : 'No';

  }


  if (
    field.type === 'text' &&
    item.value
  ) {

    return (
      item.value.text || ''
    );

  }


  if (
    field.type === 'number' &&
    item.value
  ) {

    return (
      item.value.number ?? ''
    );

  }


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


// =====================================================
// SCHEDULE CALCULATIONS
// =====================================================

function calculateScheduleStatus(
  baselineFinish,
  dueDate
) {

  if (!baselineFinish) {

    return {
      status: 'No Baseline',
      varianceDays: null
    };

  }


  if (!dueDate) {

    return {
      status: 'No Due Date',
      varianceDays: null
    };

  }


  const baseline =
    startOfDay(
      new Date(baselineFinish)
    );


  const due =
    startOfDay(
      new Date(dueDate)
    );


  if (
    Number.isNaN(
      baseline.getTime()
    ) ||
    Number.isNaN(
      due.getTime()
    )
  ) {

    return {
      status: 'No Baseline',
      varianceDays: null
    };

  }


  const difference =
    Math.round(
      (
        baseline.getTime() -
        due.getTime()
      ) /
      86400000
    );


  if (difference > 0) {

    return {
      status: 'At Risk',
      varianceDays: difference
    };

  }


  if (difference === 0) {

    return {
      status: 'Due on Baseline',
      varianceDays: 0
    };

  }


  return {
    status: 'On Track',
    varianceDays: difference
  };

}


function startOfDay(date) {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

}


// =====================================================
// FILTER BUILDERS
// =====================================================

function buildListFilter() {

  const select =
    document.getElementById(
      'listFilter'
    );


  uniqueSorted(
    lists.map(
      function (list) {

        return list.name;

      }
    )
  )
    .forEach(
      function (value) {

        addOption(
          select,
          value,
          value
        );

      }
    );

}


function buildLabelFilter() {

  const select =
    document.getElementById(
      'labelFilter'
    );


  const values = [];


  rows.forEach(
    function (row) {

      row.labels.forEach(
        function (label) {

          if (label.name) {

            values.push(
              label.name
            );

          }

        }
      );

    }
  );


  uniqueSorted(values)
    .forEach(
      function (value) {

        addOption(
          select,
          value,
          value
        );

      }
    );

}


function buildMemberFilter() {

  const select =
    document.getElementById(
      'memberFilter'
    );


  const values = [];


  rows.forEach(
    function (row) {

      row.members.forEach(
        function (member) {

          values.push(
            member.fullName
          );

        }
      );

    }
  );


  uniqueSorted(values)
    .forEach(
      function (value) {

        addOption(
          select,
          value,
          value
        );

      }
    );

}


// Custom Fields remain filterable automatically.
// We exclude Responsible here because it receives its
// own useful filter via the same mechanism anyway.

function buildCustomFilters() {

  const container =
    document.getElementById(
      'customFilters'
    );


  container.innerHTML = '';


  customFields.forEach(
    function (field) {

      const values = [];


      rows.forEach(
        function (row) {

          const value =
            row.custom[field.id];


          if (
            value !== '' &&
            value !== null &&
            value !== undefined
          ) {

            if (
              field.type === 'date'
            ) {

              values.push(
                formatDate(value)
              );

            } else {

              values.push(
                String(value)
              );

            }

          }

        }
      );


      if (!values.length) {

        return;

      }


      const select =
        document.createElement(
          'select'
        );


      select.className =
        'custom-filter';


      select.dataset.fieldId =
        field.id;


      select.dataset.fieldType =
        field.type;


      addOption(
        select,
        '',
        'All ' + field.name
      );


      uniqueSorted(values)
        .forEach(
          function (value) {

            addOption(
              select,
              value,
              value
            );

          }
        );


      container.appendChild(
        select
      );

    }
  );

}


function addOption(
  select,
  value,
  label
) {

  const option =
    document.createElement(
      'option'
    );


  option.value =
    value;


  option.textContent =
    label;


  select.appendChild(
    option
  );

}


function uniqueSorted(values) {

  return Array
    .from(
      new Set(
        values.filter(Boolean)
      )
    )
    .sort(
      function (a, b) {

        return String(a)
          .localeCompare(
            String(b),
            undefined,
            {
              numeric: true,
              sensitivity: 'base'
            }
          );

      }
    );

}


// =====================================================
// HEADERS
// =====================================================

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


  columns.push(
    {
      key: 'varianceDays',
      label: 'Variance'
    },
    {
      key: 'scheduleStatus',
      label: 'Schedule Status'
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


// =====================================================
// SORTING
// =====================================================

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


// =====================================================
// FILTERING
// =====================================================

function getVisibleRows() {

  const search =
    normalise(
      document
        .getElementById(
          'searchInput'
        )
        .value
    );


  const selectedList =
    document
      .getElementById(
        'listFilter'
      )
      .value;


  const selectedLabel =
    document
      .getElementById(
        'labelFilter'
      )
      .value;


  const selectedMember =
    document
      .getElementById(
        'memberFilter'
      )
      .value;


  const selectedStatus =
    document
      .getElementById(
        'statusFilter'
      )
      .value;


  const customFilters =
    document.querySelectorAll(
      '.custom-filter'
    );


  const filtered =
    rows.filter(
      function (row) {


        if (
          selectedList &&
          row.list !== selectedList
        ) {

          return false;

        }


        if (
          selectedLabel &&
          !row.labels.some(
            function (label) {

              return (
                label.name ===
                selectedLabel
              );

            }
          )
        ) {

          return false;

        }


        if (
          selectedMember &&
          !row.members.some(
            function (member) {

              return (
                member.fullName ===
                selectedMember
              );

            }
          )
        ) {

          return false;

        }


        if (
          selectedStatus &&
          row.scheduleStatus !==
          selectedStatus
        ) {

          return false;

        }


        if (search) {

          const searchText =
            normalise(
              [

                row.name,

                row.list,

                row.labels
                  .map(
                    function (label) {

                      return label.name;

                    }
                  )
                  .join(' '),

                row.members
                  .map(
                    function (member) {

                      return member.fullName;

                    }
                  )
                  .join(' '),

                ...Object.values(
                  row.custom
                )

              ].join(' ')
            );


          if (
            !searchText.includes(
              search
            )
          ) {

            return false;

          }

        }


        for (
          const filter
          of customFilters
        ) {

          if (!filter.value) {

            continue;

          }


          const fieldId =
            filter.dataset.fieldId;


          const type =
            filter.dataset.fieldType;


          let rowValue =
            row.custom[fieldId] ?? '';


          if (
            type === 'date' &&
            rowValue
          ) {

            rowValue =
              formatDate(rowValue);

          }


          if (
            String(rowValue) !==
            filter.value
          ) {

            return false;

          }

        }


        return true;

      }
    );


  filtered.sort(
    compareRows
  );


  return filtered;

}


// =====================================================
// SORT VALUES
// =====================================================

function compareRows(a, b) {

  const valueA =
    getSortValue(
      a,
      sortKey
    );


  const valueB =
    getSortValue(
      b,
      sortKey
    );


  if (
    typeof valueA === 'number' &&
    typeof valueB === 'number'
  ) {

    return (
      valueA - valueB
    ) * sortDirection;

  }


  return String(valueA ?? '')
    .localeCompare(
      String(valueB ?? ''),
      undefined,
      {
        numeric: true,
        sensitivity: 'base'
      }
    )
    * sortDirection;

}


function getSortValue(
  row,
  key
) {

  if (
    key.startsWith(
      'custom:'
    )
  ) {

    return (
      row.custom[
        key.substring(7)
      ] ?? ''
    );

  }


  if (
    key === 'labels'
  ) {

    return row.labels
      .map(
        function (label) {

          return label.name;

        }
      )
      .join(' ');

  }


  if (
    key === 'members'
  ) {

    return row.members
      .map(
        function (member) {

          return member.fullName;

        }
      )
      .join(' ');

  }


  if (
    key === 'varianceDays'
  ) {

    return (
      row.varianceDays ??
      999999
    );

  }


  return (
    row[key] ?? ''
  );

}


// =====================================================
// RENDER TABLE
// =====================================================

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
      7 +
      customFields.length;


    td.className =
      'empty-state';


    td.textContent =
      'No cards match the current filters.';


    tr.appendChild(td);

    tbody.appendChild(tr);

  }


  visible.forEach(
    function (row) {

      const tr =
        document.createElement(
          'tr'
        );


      if (row.atRisk) {

        tr.classList.add(
          'at-risk'
        );

      }


      renderCardCell(
        tr,
        row
      );


      addTextCell(
        tr,
        row.list
      );


      renderLabelsCell(
        tr,
        row.labels
      );


      renderMembersCell(
        tr,
        row.members
      );


      renderDueDateCell(
        tr,
        row
      );


      customFields.forEach(
        function (field) {

          let value =
            row.custom[field.id];


          if (
            field.type === 'date'
          ) {

            value =
              formatDate(value);

          }


          addTextCell(
            tr,
            value
          );

        }
      );


      renderVarianceCell(
        tr,
        row
      );


      renderStatusCell(
        tr,
        row
      );


      tbody.appendChild(tr);

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


// =====================================================
// CARD CELL
// =====================================================

function renderCardCell(
  rowElement,
  row
) {

  const td =
    document.createElement(
      'td'
    );

  const link =
    document.createElement(
      'a'
    );

  link.className =
    'card-button';

  link.href =
    row.url;

  link.target =
    '_blank';

  link.rel =
    'noopener noreferrer';

  link.textContent =
    row.name;

  link.title =
    'Open card in new tab';

  td.appendChild(link);

  rowElement.appendChild(td);

}


// =====================================================
// LABELS
// =====================================================

function renderLabelsCell(
  rowElement,
  labels
) {

  const td =
    document.createElement(
      'td'
    );


  const wrapper =
    document.createElement(
      'div'
    );


  wrapper.className =
    'label-wrap';


  labels.forEach(
    function (label) {

      const span =
        document.createElement(
          'span'
        );


      span.className =
        'trello-label';


      span.textContent =
        label.name;


      applyLabelColor(
        span,
        label.color
      );


      wrapper.appendChild(
        span
      );

    }
  );


  td.appendChild(wrapper);

  rowElement.appendChild(td);

}


function applyLabelColor(
  element,
  color
) {

  const palette = {

    green: [
      '#4bce97',
      '#164b35'
    ],

    yellow: [
      '#f5cd47',
      '#533f04'
    ],

    orange: [
      '#fea362',
      '#702e00'
    ],

    red: [
      '#f87168',
      '#5d1f1a'
    ],

    purple: [
      '#9f8fef',
      '#352c63'
    ],

    blue: [
      '#579dff',
      '#09326c'
    ],

    sky: [
      '#6cc3e0',
      '#164555'
    ],

    lime: [
      '#94c748',
      '#37471f'
    ],

    pink: [
      '#e774bb',
      '#50253f'
    ],

    black: [
      '#8590a2',
      '#172b4d'
    ]

  };


  let key =
    String(color || '')
      .replace(
        /_(light|dark)$/,
        ''
      );


  const selected =
    palette[key];


  if (selected) {

    element.style.backgroundColor =
      selected[0];

    element.style.color =
      selected[1];

  } else {

    element.style.backgroundColor =
      '#dfe1e6';

    element.style.color =
      '#172b4d';

  }

}


// =====================================================
// MEMBERS
// =====================================================

function renderMembersCell(
  rowElement,
  members
) {

  const td =
    document.createElement(
      'td'
    );


  const stack =
    document.createElement(
      'div'
    );


  stack.className =
    'member-stack';


  members.forEach(
    function (member) {

      let element;


      if (member.avatar) {

        element =
          document.createElement(
            'img'
          );


        element.src =
          member.avatar;


        element.alt =
          member.fullName;


        element.className =
          'member-avatar';


        element.addEventListener(
          'error',
          function () {

            const initials =
              createInitialElement(
                member
              );


            element.replaceWith(
              initials
            );

          },
          {
            once: true
          }
        );

      } else {

        element =
          createInitialElement(
            member
          );

      }


      element.title =
        member.fullName;


      stack.appendChild(
        element
      );

    }
  );


  td.appendChild(stack);

  rowElement.appendChild(td);

}


function createInitialElement(
  member
) {

  const span =
    document.createElement(
      'span'
    );


  span.className =
    'member-initials';


  span.textContent =
    member.initials ||
    createInitials(
      member.fullName
    );


  span.title =
    member.fullName;


  return span;

}


// =====================================================
// DUE DATE
// =====================================================

function renderDueDateCell(
  rowElement,
  row
) {

  const td =
    document.createElement(
      'td'
    );


  td.className =
    'date-cell';


  if (!row.due) {

    rowElement.appendChild(td);

    return;

  }


  const date =
    document.createElement(
      'span'
    );


  date.textContent =
    formatDate(
      row.due
    );


  td.appendChild(date);


  if (!row.dueComplete) {

    const dueStatus =
      getDueStatus(
        row.due
      );


    if (dueStatus) {

      const note =
        document.createElement(
          'span'
        );


      note.className =
        'date-note ' +
        dueStatus.className;


      note.textContent =
        dueStatus.text;


      td.appendChild(note);

    }

  }


  rowElement.appendChild(td);

}


function getDueStatus(value) {

  const due =
    startOfDay(
      new Date(value)
    );


  const today =
    startOfDay(
      new Date()
    );


  const days =
    Math.round(
      (
        due.getTime() -
        today.getTime()
      ) /
      86400000
    );


  if (days < 0) {

    return {
      text: 'Overdue',
      className: 'overdue'
    };

  }


  if (
    days >= 0 &&
    days <= 7
  ) {

    return {
      text: 'Due soon',
      className: 'due-soon'
    };

  }


  return null;

}


// =====================================================
// VARIANCE
// =====================================================

function renderVarianceCell(
  rowElement,
  row
) {

  const td =
    document.createElement(
      'td'
    );


  if (
    row.varianceDays === null
  ) {

    td.textContent = '—';

    rowElement.appendChild(td);

    return;

  }


  const days =
    row.varianceDays;


  if (days > 0) {

    td.textContent =
      '+' +
      days +
      (
        days === 1
          ? ' day'
          : ' days'
      );


    td.className =
      'variance-positive';

  } else if (days < 0) {

    td.textContent =
      days +
      (
        days === -1
          ? ' day'
          : ' days'
      );


    td.className =
      'variance-negative';

  } else {

    td.textContent =
      '0 days';

  }


  rowElement.appendChild(td);

}


// =====================================================
// STATUS
// =====================================================

function renderStatusCell(
  rowElement,
  row
) {

  const td =
    document.createElement(
      'td'
    );


  td.className =
    'status';


  td.textContent =
    row.scheduleStatus;


  if (
    row.scheduleStatus ===
    'At Risk'
  ) {

    td.classList.add(
      'status-risk'
    );

  } else if (
    row.scheduleStatus ===
    'On Track'
  ) {

    td.classList.add(
      'status-on-track'
    );

  } else {

    td.classList.add(
      'status-neutral'
    );

  }


  rowElement.appendChild(td);

}


// =====================================================
// GENERAL HELPERS
// =====================================================

function addTextCell(
  row,
  value
) {

  const td =
    document.createElement(
      'td'
    );


  td.textContent =
    value ?? '';


  row.appendChild(td);

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


// =====================================================
// EVENTS
// =====================================================

function bindEvents() {

  document
    .getElementById(
      'searchInput'
    )
    .addEventListener(
      'input',
      render
    );


  [
    'listFilter',
    'labelFilter',
    'memberFilter',
    'statusFilter'
  ]
    .forEach(
      function (id) {

        document
          .getElementById(id)
          .addEventListener(
            'change',
            render
          );

      }
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
      clearFilters
    );

}


function clearFilters() {

  document
    .getElementById(
      'searchInput'
    )
    .value = '';


  [
    'listFilter',
    'labelFilter',
    'memberFilter',
    'statusFilter'
  ]
    .forEach(
      function (id) {

        document
          .getElementById(id)
          .value = '';

      }
    );


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


// =====================================================
// ERROR
// =====================================================

function showError(error) {

  console.error(error);


  const loading =
    document.getElementById(
      'loading'
    );


  loading.className =
    'error';


  loading.innerHTML =
    '<strong>Detailed Table could not load.</strong>' +
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


// =====================================================
// RUN
// =====================================================

init();
