/***** Mariah's Home Library — Apps Script Web App *****/
const TAB_LIBRARY = 'LIBRARY';
const TAB_LOG = 'CHECKOUT LOG';
const TAB_BORROWERS = 'BORROWERS';
const SPREADSHEET_ID = '1rRO12mPbnNFE12G3c3hL_VlbHsrUSQeO';
const BACKEND_VERSION = '11';

const LIB_HEADERS = ['Barcode','Book ID','Title','Author','Publisher','Publication Year','Genre','Status','Borrower','Checkout Date','Due Date','Notes'];
const LOG_HEADERS = ['Checkout Date','Book ID','Title','Borrower','Action','Due Date','Return Date','Days Late','Notes'];
const BORROWER_HEADERS = ['Name'];
const COL_BARCODE = 0, COL_BOOK_ID = 1, COL_TITLE = 2, COL_AUTHOR = 3, COL_PUBLISHER = 4, COL_YEAR = 5,
  COL_GENRE = 6, COL_STATUS = 7, COL_BORROWER = 8, COL_CHECKOUT = 9, COL_DUE = 10, COL_NOTES = 11;

function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function getLibrarySpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  const width = Math.max(sheet.getLastColumn(), headers.length);
  const current = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
  headers.forEach((header, index) => { if (!String(current[index] || '').trim()) sheet.getRange(1, index + 1).setValue(header); });
  return sheet;
}

function ensureSchema_() {
  const ss = getLibrarySpreadsheet();
  return {
    ss,
    lib: ensureSheet_(ss, TAB_LIBRARY, LIB_HEADERS),
    log: ensureSheet_(ss, TAB_LOG, LOG_HEADERS),
    borrowers: ensureSheet_(ss, TAB_BORROWERS, BORROWER_HEADERS)
  };
}

function doGet(e) {
  try {
    if (e.parameter.health === '1') return json_({ success: true, app: "Mariah's Library", version: BACKEND_VERSION });
    if (e.parameter.request) return handleMutation(JSON.parse(e.parameter.request));
    const { lib, log, borrowers } = ensureSchema_();
    const sheet = e.parameter.tab === TAB_LIBRARY ? lib : e.parameter.tab === TAB_LOG ? log : e.parameter.tab === TAB_BORROWERS ? borrowers : null;
    if (!sheet) return json_({ success: false, message: 'Invalid tab specified.' });
    const lastRow = sheet.getLastRow(), lastColumn = sheet.getLastColumn();
    const headers = lastColumn ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0] : [];
    let data = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues() : [];
    if (e.parameter.tab === TAB_LIBRARY) {
      data.forEach((row, index) => {
        const borrower = String(row[COL_BORROWER] || '').trim();
        const status = String(row[COL_STATUS] || '').trim();
        if (borrower && status !== 'Checked Out') {
          row[COL_STATUS] = 'Checked Out';
          lib.getRange(index + 2, COL_STATUS + 1).setValue('Checked Out');
        }
      });
      data = data.filter(row => String(row[COL_BOOK_ID] || '').trim());
    }
    return json_({ success: true, headers, data });
  } catch (error) { return json_({ success: false, message: `Error: ${error.message}` }); }
}

function doPost(e) {
  try { return handleMutation(JSON.parse(e.postData.contents)); }
  catch (error) { return json_({ success: false, message: `Error: ${error.message}` }); }
}

function findBookRow_(lib, identifier) {
  const lastRow = lib.getLastRow();
  if (lastRow < 2) return -1;
  const target = String(identifier || '').trim();
  const ids = lib.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
  const index = ids.findIndex(row => String(row[0]).trim() === target || String(row[1]).trim() === target);
  return index === -1 ? -1 : index + 2;
}

function uniqueBookId_(lib) {
  const existing = new Set();
  if (lib.getLastRow() > 1) lib.getRange(2, COL_BOOK_ID + 1, lib.getLastRow() - 1, 1).getDisplayValues().forEach(row => existing.add(String(row[0]).trim()));
  let id;
  do { id = `ML-${Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase()}`; } while (existing.has(id));
  return id;
}

function appendLog_(log, checkoutDate, bookId, title, borrower, action, dueDate, returnDate, daysLate, notes) {
  log.appendRow([checkoutDate || '', bookId, title, borrower || '', action, dueDate || '', returnDate || '', daysLate === '' ? '' : daysLate, notes || '']);
}

function handleMutation(request) {
  try {
    const { lib, log, borrowers } = ensureSchema_();
    const action = String(request.action || '').trim();

    if (action === 'addBook') {
      const book = request.book || request || {};
      const title = String(book.title || '').trim();
      if (!title) return json_({ success: false, message: 'Book title is required.' });
      const bookId = uniqueBookId_(lib), barcode = bookId;
      lib.appendRow([barcode, bookId, title, String(book.author || '').trim(), String(book.publisher || '').trim(), String(book.publicationYear || '').trim(), String(book.genre || '').trim(), 'On Shelf', '', '', '', String(book.notes || '').trim()]);
      return json_({ success: true, message: `Saved '${title}' as physical copy ${bookId}.`, bookId, barcode });
    }

    if (action === 'addBorrower') {
      const name = String(request.borrowerName || '').trim();
      if (!name) return json_({ success: false, message: 'Borrower name is required.' });
      const existing = borrowers.getLastRow() > 1 ? borrowers.getRange(2, 1, borrowers.getLastRow() - 1, 1).getDisplayValues().map(row => String(row[0]).trim().toLowerCase()) : [];
      if (existing.includes(name.toLowerCase())) return json_({ success: false, message: `Borrower '${name}' already exists.` });
      borrowers.appendRow([name]);
      return json_({ success: true, message: `Borrower '${name}' added.` });
    }

    if (action === 'editBorrower') {
      const oldName = String(request.oldName || '').trim(), newName = String(request.newName || '').trim();
      if (!oldName || !newName) return json_({ success: false, message: 'Original and new borrower names are required.' });
      if (borrowers.getLastRow() < 2) return json_({ success: false, message: `Borrower '${oldName}' not found.` });
      const names = borrowers.getRange(2, 1, borrowers.getLastRow() - 1, 1).getDisplayValues();
      const index = names.findIndex(row => String(row[0]).trim().toLowerCase() === oldName.toLowerCase());
      if (index === -1) return json_({ success: false, message: `Borrower '${oldName}' not found.` });
      if (names.some((row, i) => i !== index && String(row[0]).trim().toLowerCase() === newName.toLowerCase())) return json_({ success: false, message: `Borrower '${newName}' already exists.` });
      borrowers.getRange(index + 2, 1).setValue(newName);
      if (lib.getLastRow() > 1) lib.getRange(2, COL_BORROWER + 1, lib.getLastRow() - 1, 1).getDisplayValues().forEach((row, i) => { if (String(row[0]).trim().toLowerCase() === oldName.toLowerCase()) lib.getRange(i + 2, COL_BORROWER + 1).setValue(newName); });
      return json_({ success: true, message: `Borrower '${oldName}' updated to '${newName}'.` });
    }

    if (action === 'updateBook') {
      const bookId = String(request.bookId || '').trim(), book = request.book || {}, row = findBookRow_(lib, bookId);
      if (row === -1) return json_({ success: false, message: `Book ID not found: ${bookId}` });
      const title = String(book.title || '').trim();
      if (!title) return json_({ success: false, message: 'Book title is required.' });
      const values = lib.getRange(row, 1, 1, LIB_HEADERS.length).getValues()[0];
      values[COL_TITLE] = title; values[COL_AUTHOR] = String(book.author || '').trim(); values[COL_PUBLISHER] = String(book.publisher || '').trim(); values[COL_YEAR] = String(book.publicationYear || '').trim(); values[COL_GENRE] = String(book.genre || '').trim(); values[COL_NOTES] = String(book.notes || '').trim();
      lib.getRange(row, 1, 1, LIB_HEADERS.length).setValues([values]);
      appendLog_(log, new Date(), bookId, title, String(values[COL_BORROWER] || ''), 'Edited', '', '', '', 'Book details updated');
      return json_({ success: true, message: `Updated '${title}'.` });
    }

    if (action === 'deleteBook') {
      const bookId = String(request.bookId || '').trim(), row = findBookRow_(lib, bookId);
      if (row === -1) return json_({ success: false, message: `Book ID not found: ${bookId}` });
      const title = String(lib.getRange(row, COL_TITLE + 1).getDisplayValue()).trim();
      const status = String(lib.getRange(row, COL_STATUS + 1).getDisplayValue()).trim() || 'On Shelf';
      const borrower = String(lib.getRange(row, COL_BORROWER + 1).getDisplayValue()).trim();
      if (status === 'Checked Out' || borrower) return json_({ success: false, message: `Check in '${title}' before deleting it.` });
      appendLog_(log, new Date(), bookId, title, '', 'Deleted', '', '', '', 'Library record deleted; prior checkout history retained');
      lib.deleteRow(row);
      return json_({ success: true, message: `Deleted '${title}'. Checkout history was kept.` });
    }

    if (action === 'updateBookStatus' || action === 'archiveBook') {
      const bookId = String(request.bookId || '').trim(), row = findBookRow_(lib, bookId);
      if (row === -1) return json_({ success: false, message: `Book ID not found: ${bookId}` });
      const title = String(lib.getRange(row, COL_TITLE + 1).getDisplayValue()).trim();
      const currentBorrower = String(lib.getRange(row, COL_BORROWER + 1).getDisplayValue()).trim();
      const currentStatus = currentBorrower ? 'Checked Out' : (String(lib.getRange(row, COL_STATUS + 1).getDisplayValue()).trim() || 'On Shelf');
      const newStatus = action === 'archiveBook' ? (request.archived === false ? 'On Shelf' : 'Archived') : String(request.status || '').trim();
      if (!['On Shelf','Missing','Repair','Archived'].includes(newStatus)) return json_({ success: false, message: 'Use Scan Station to check out a book.' });
      if (newStatus === 'Archived' && currentStatus === 'Checked Out') return json_({ success: false, message: `Check in '${title}' before archiving it.` });
      lib.getRange(row, COL_STATUS + 1).setValue(newStatus); lib.getRange(row, COL_BORROWER + 1, 1, 3).clearContent();
      appendLog_(log, new Date(), bookId, title, '', newStatus === 'Archived' ? 'Archived' : `Status → ${newStatus}`, '', '', '', 'Manual status update');
      return json_({ success: true, message: `Updated '${title}' to ${newStatus}.` });
    }

    const scannedId = String(request.bookId || '').trim(), operation = String(request.operation || '').trim().toLowerCase(), borrower = String(request.borrower || '').trim();
    const dueDays = Number(request.dueDays) > 0 ? Number(request.dueDays) : 14;
    if (!scannedId) return json_({ success: false, message: 'Book ID is required.' });
    if (!['checkout','return'].includes(operation)) return json_({ success: false, message: 'Choose Check Out or Check In.' });
    const row = findBookRow_(lib, scannedId);
    if (row === -1) return json_({ success: false, message: `Book ID not found: ${scannedId}` });
    const bookId = String(lib.getRange(row, COL_BOOK_ID + 1).getDisplayValue()).trim(), title = String(lib.getRange(row, COL_TITLE + 1).getDisplayValue()).trim();
    const statusCell = lib.getRange(row, COL_STATUS + 1), borrowerCell = lib.getRange(row, COL_BORROWER + 1), checkoutCell = lib.getRange(row, COL_CHECKOUT + 1), dueCell = lib.getRange(row, COL_DUE + 1);
    const assignedBorrower = String(borrowerCell.getDisplayValue()).trim();
    let status = String(statusCell.getDisplayValue()).trim() || 'On Shelf';
    if (assignedBorrower && status !== 'Checked Out') { status = 'Checked Out'; statusCell.setValue(status); }
    const now = new Date();

    if (operation === 'checkout') {
      if (status !== 'On Shelf') return json_({ success: false, message: `'${title}' is unavailable (${status}).` });
      if (!borrower) return json_({ success: false, message: 'Borrower is required for checkout.' });
      const dueDate = new Date(now.getTime()); dueDate.setDate(dueDate.getDate() + dueDays);
      statusCell.setValue('Checked Out'); borrowerCell.setValue(borrower); checkoutCell.setValue(now); dueCell.setValue(dueDate);
      appendLog_(log, now, bookId, title, borrower, 'Checkout', dueDate, '', '', '');
      return json_({ success: true, action: 'Checkout', bookId, title, borrower, newStatus: 'Checked Out', dueDate: Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'MMM d, yyyy'), timestamp: Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a'), message: `Checkout: ${bookId} (${title}) by ${borrower}` });
    }

    if (status !== 'Checked Out') return json_({ success: false, message: `'${title}' is not checked out (status: ${status}).` });
    const transactionBorrower = assignedBorrower || borrower, checkoutDate = checkoutCell.getValue(), dueDate = dueCell.getValue();
    const daysLate = dueDate instanceof Date && !isNaN(dueDate) ? Math.max(0, Math.ceil((now.getTime() - dueDate.getTime()) / 86400000)) : 0;
    statusCell.setValue('On Shelf'); borrowerCell.clearContent(); checkoutCell.clearContent(); dueCell.clearContent();
    appendLog_(log, checkoutDate, bookId, title, transactionBorrower, 'Return', dueDate, now, daysLate, daysLate > 0 ? `${daysLate} day${daysLate === 1 ? '' : 's'} late` : 'On time');
    return json_({ success: true, action: 'Return', bookId, title, borrower: transactionBorrower, newStatus: 'On Shelf', dueDate: dueDate instanceof Date ? Utilities.formatDate(dueDate, Session.getScriptTimeZone(), 'MMM d, yyyy') : '', timestamp: Utilities.formatDate(now, Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a'), daysLate, message: daysLate > 0 ? `Return: ${title} was ${daysLate} day${daysLate === 1 ? '' : 's'} late.` : `Return: ${title} was on time.` });
  } catch (error) { return json_({ success: false, message: `Error: ${error.message}` }); }
}
