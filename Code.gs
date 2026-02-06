
/***** Home Library Automation (Web App Version) *****
Tabs:
- LIBRARY
- CHECKOUT LOG
- BORROWERS

LIBRARY columns (0-indexed for script):
A Barcode (0)
B Book ID (1)
C Title (2)
D Author (3)
E Publisher (4)
F Publication Year (5)
G Genre (6)
H Status (7)
I Borrower (8)
J Checkout Date (9)
K Due Date (10)
L Notes (11)

CHECKOUT LOG columns (0-indexed for script):
A Timestamp (0)
B Book ID (1)
C Title (2)
D Borrower (3)
E Action (4)
F Notes (5)

BORROWERS columns (0-indexed for script):
A Name (0)
************************************/

const TAB_LIBRARY = "LIBRARY";
const TAB_LOG = "CHECKOUT LOG";
const TAB_BORROWERS = "BORROWERS"; // New constant for borrowers tab

// LIBRARY column indices (0-indexed for script internal use)
const COL_BARCODE_IDX = 0; // A
const COL_BOOK_ID_IDX = 1; // B
const COL_TITLE_IDX = 2;   // C
const COL_AUTHOR_IDX = 3; // D (New)
const COL_PUBLISHER_IDX = 4; // E (New)
const COL_PUB_YEAR_IDX = 5; // F (New)
const COL_GENRE_IDX = 6;   // G (was D)
const COL_STATUS_IDX = 7;  // H (was E)
const COL_BORROWER_IDX = 8;// I (was F)
const COL_CHECKOUT_DATE_IDX = 9; // J (was G)
const COL_DUE_DATE_IDX = 10; // K (was H)
const COL_NOTES_IDX = 11;   // L (was I)

// CHECKOUT LOG column indices (0-indexed for script internal use)
const LOG_COL_TIMESTAMP_IDX = 0; // A
const LOG_COL_BOOK_ID_IDX = 1;   // B
const LOG_COL_TITLE_IDX = 2;     // C
const LOG_COL_BORROWER_IDX = 3;  // D
const LOG_COL_ACTION_IDX = 4;    // E
const LOG_COL_NOTES_IDX = 5;     // F

// BORROWERS column indices (0-indexed for script internal use)
const BORROWER_COL_NAME_IDX = 0; // A

/**
 * Ensures proper CORS headers for web app deployment.
 */
function setCorsHeaders(response) {
  response.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for specific origins in production
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '3600'); // Cache preflight results for 1 hour
  return response;
}

/**
 * Handles OPTIONS requests for CORS preflight.
 * This is crucial for cross-origin communication, especially for POST requests.
 */
function doOptions() {
  const response = ContentService.createTextOutput('');
  // Explicitly set Content-Type for OPTIONS, as browser might expect it.
  response.setMimeType(ContentService.MimeType.JSON); 
  return setCorsHeaders(response);
}

/**
 * Handles GET requests from the web app for fetching data from various tabs.
 */
function doGet(e) {
  const tabName = e.parameter.tab;
  try {
    const ss = SpreadsheetApp.getActive();
    let responseData = { success: false, message: 'Invalid tab specified.' };

    if (tabName === TAB_LIBRARY) {
      const lib = ss.getSheetByName(TAB_LIBRARY);
      if (!lib) throw new Error(`Tab not found: ${TAB_LIBRARY}`);
      const lastRow = lib.getLastRow();
      let headers: string[] = [];
      let data: string[][] = [];
      if (lastRow > 0) { // Fetch headers even if only header row exists
        headers = lib.getRange(1, 1, 1, lib.getLastColumn()).getValues()[0] as string[];
        if (lastRow > 1) { // Fetch data only if there are rows beyond the header
          data = lib.getRange(2, 1, lastRow - 1, lib.getLastColumn()).getDisplayValues() as string[][];
        }
      }
      responseData = { success: true, headers: headers, data: data, message: 'Library data fetched successfully.' } as any;

    } else if (tabName === TAB_LOG) {
      const log = ss.getSheetByName(TAB_LOG);
      if (!log) throw new Error(`Tab not found: ${TAB_LOG}`);
      const lastRow = log.getLastRow();
      let headers: string[] = [];
      let data: string[][] = [];
      if (lastRow > 0) { // Fetch headers even if only header row exists
        headers = log.getRange(1, 1, 1, log.getLastColumn()).getValues()[0] as string[];
        if (lastRow > 1) { // Fetch data only if there are rows beyond the header
          data = log.getRange(2, 1, lastRow - 1, log.getLastColumn()).getDisplayValues() as string[][];
        }
      }
      responseData = { success: true, headers: headers, data: data, message: 'Checkout log fetched successfully.' } as any;

    } else if (tabName === TAB_BORROWERS) { // New logic for borrowers tab
      const borrowersSheet = ss.getSheetByName(TAB_BORROWERS);
      if (!borrowersSheet) throw new Error(`Tab not found: ${TAB_BORROWERS}`);
      const lastRow = borrowersSheet.getLastRow();
      let names: string[] = [];
      // Assuming "Name" is the only header and it's always in row 1
      let headers = ["Name"]; 
      if (lastRow > 1) { // Fetch data only if there are rows beyond the header
        names = (borrowersSheet.getRange(2, 1, lastRow - 1, 1).getValues() as string[][]).map(row => row[0]);
      }
      responseData = { success: true, headers: headers, data: names.map(name => [name]), message: 'Borrowers data fetched successfully.' } as any;

    } else {
      throw new Error("Invalid tab specified.");
    }

    const output = ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
    return setCorsHeaders(output);

  } catch (err: any) {
    const errorOutput = ContentService.createTextOutput(JSON.stringify({ success: false, message: `Error: ${err.message}` }))
      .setMimeType(ContentService.MimeType.JSON);
    return setCorsHeaders(errorOutput);
  }
}

/**
 * Handles POST requests from the web app for scanning/checking out/returning books or adding/editing borrowers.
 * Expected JSON payload:
 * - For scan: { bookId: string, borrower: string, dueDays: number }
 * - For add borrower: { action: 'addBorrower', borrowerName: string }
 * - For edit borrower: { action: 'editBorrower', oldName: string, newName: string }
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActive();

    // Handle adding a new borrower
    if (request.action === 'addBorrower') {
      const borrowerName = String(request.borrowerName || '').trim();
      if (!borrowerName) {
        return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: false, message: "Borrower name is required." })))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const borrowersSheet = ss.getSheetByName(TAB_BORROWERS);
      if (!borrowersSheet) throw new Error(`Tab not found: ${TAB_BORROWERS}`);

      // Check for duplicate borrower name (case-insensitive)
      const lastRow = borrowersSheet.getLastRow();
      if (lastRow > 1) {
        const existingNames = (borrowersSheet.getRange(2, BORROWER_COL_NAME_IDX + 1, lastRow - 1, 1).getValues() as string[][])
                               .map(row => String(row[0]).trim().toLowerCase());
        if (existingNames.includes(borrowerName.toLowerCase())) {
          return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: false, message: `Borrower '${borrowerName}' already exists.` })))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      borrowersSheet.appendRow([borrowerName]);
      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true, message: `Borrower '${borrowerName}' added successfully.` })))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle editing an existing borrower
    if (request.action === 'editBorrower') {
      const oldName = String(request.oldName || '').trim();
      const newName = String(request.newName || '').trim();

      if (!oldName) {
        return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: false, message: "Original borrower name is required for editing." })))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (!newName) {
        return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: false, message: "New borrower name cannot be empty." })))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (oldName.toLowerCase() === newName.toLowerCase()) {
        return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true, message: "No change detected." })))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const borrowersSheet = ss.getSheetByName(TAB_BORROWERS);
      if (!borrowersSheet) throw new Error(`Tab not found: ${TAB_BORROWERS}`);
      const lib = ss.getSheetByName(TAB_LIBRARY);
      if (!lib) throw new Error(`Tab not found: ${TAB_LIBRARY}`);

      const lastBorrowerRow = borrowersSheet.getLastRow();
      let foundBorrowerRow = -1; // 1-indexed sheet row for the borrower
      const borrowerNames = borrowersSheet.getRange(2, BORROWER_COL_NAME_IDX + 1, lastBorrowerRow - 1, 1).getValues() as string[][];

      for (let i = 0; i < borrowerNames.length; i++) {
        if (String(borrowerNames[i][0]).trim().toLowerCase() === oldName.toLowerCase()) {
          foundBorrowerRow = i + 2; // +2 because range starts at row 2
          break;
        }
      }

      if (foundBorrowerRow === -1) {
        return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: false, message: `Borrower '${oldName}' not found.` })))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Check for duplicate new name, excluding the old name's position
      for (let i = 0; i < borrowerNames.length; i++) {
        if (i + 2 !== foundBorrowerRow && String(borrowerNames[i][0]).trim().toLowerCase() === newName.toLowerCase()) {
          return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: false, message: `Borrower '${newName}' already exists.` })))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      // Update borrower name in BORROWERS tab
      borrowersSheet.getRange(foundBorrowerRow, BORROWER_COL_NAME_IDX + 1).setValue(newName);

      // Update borrower name in LIBRARY tab for checked out books
      const lastLibraryRow = lib.getLastRow();
      if (lastLibraryRow > 1) {
        const libraryData = lib.getRange(2, COL_BORROWER_IDX + 1, lastLibraryRow - 1, 1).getValues() as string[][];
        for (let i = 0; i < libraryData.length; i++) {
          if (String(libraryData[i][0]).trim().toLowerCase() === oldName.toLowerCase()) {
            lib.getRange(i + 2, COL_BORROWER_IDX + 1).setValue(newName);
          }
        }
      }

      return setCorsHeaders(ContentService.createTextOutput(JSON.stringify({ success: true, message: `Borrower '${oldName}' successfully updated to '${newName}'.` })))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Existing logic for scanning books
    const scannedId = String(request.bookId || '').trim();
    const borrower = String(request.borrower || '').trim();
    const dueDays = (request.dueDays && Number(request.dueDays) > 0) ? Number(request.dueDays) : 14;

    if (!scannedId) {
      const output = ContentService.createTextOutput(JSON.stringify({ success: false, message: "Book ID is required." }))
        .setMimeType(ContentService.MimeType.JSON);
      return setCorsHeaders(output);
    }
    if (!borrower) {
      const output = ContentService.createTextOutput(JSON.stringify({ success: false, message: "Borrower is required." }))
        .setMimeType(ContentService.MimeType.JSON);
      return setCorsHeaders(output);
    }

    const lib = ss.getSheetByName(TAB_LIBRARY);
    const log = ss.getSheetByName(TAB_LOG);

    if (!lib) throw new Error(`Tab not found: ${TAB_LIBRARY}`);
    if (!log) throw new Error(`Tab not found: ${TAB_LOG}`);

    const lastRow = lib.getLastRow();
    if (lastRow < 2) {
      const output = ContentService.createTextOutput(JSON.stringify({ success: false, message: "LIBRARY tab has no data." }))
        .setMimeType(ContentService.MimeType.JSON);
      return setCorsHeaders(output);
    }

    // Find matching Book ID in LIBRARY column B (COL_BOOK_ID_IDX + 1 for 1-indexed column)
    const ids = lib.getRange(2, COL_BOOK_ID_IDX + 1, lastRow - 1, 1).getValues();
    let foundRow = -1; // 1-indexed sheet row where the book is found
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === scannedId) {
        foundRow = i + 2; // +2 because range starts at row 2 (header + 1 for 0-indexed array)
        break;
      }
    }

    if (foundRow === -1) {
      const output = ContentService.createTextOutput(JSON.stringify({ success: false, message: `Book ID not found: ${scannedId}` }))
        .setMimeType(ContentService.MimeType.JSON);
      return setCorsHeaders(output);
    }

    const title = String(lib.getRange(foundRow, COL_TITLE_IDX + 1).getValue()).trim();
    const statusCell = lib.getRange(foundRow, COL_STATUS_IDX + 1);
    const currentStatus = String(statusCell.getValue()).trim() || "On Shelf";

    const borrowerCell = lib.getRange(foundRow, COL_BORROWER_IDX + 1);
    const checkoutDateCell = lib.getRange(foundRow, COL_CHECKOUT_DATE_IDX + 1);
    const dueDateCell = lib.getRange(foundRow, COL_DUE_DATE_IDX + 1);

    const now = new Date();
    let action = "";
    let newStatus = "";

    if (currentStatus.toLowerCase() === "on shelf") {
      action = "Checkout";
      newStatus = "Checked Out";
      statusCell.setValue(newStatus);
      borrowerCell.setValue(borrower);
      checkoutDateCell.setValue(now);

      const due = new Date(now.getTime());
      due.setDate(due.getDate() + dueDays);
      dueDateCell.setValue(due);
    } else {
      action = "Return";
      newStatus = "On Shelf";
      statusCell.setValue(newStatus);
      borrowerCell.clearContent();
      checkoutDateCell.clearContent();
      dueDateCell.clearContent();
    }

    // Write to CHECKOUT LOG
    // A Timestamp | B Book ID | C Title | D Borrower | E Action | F Notes
    log.appendRow([now, scannedId, title, borrower, action, ""]);

    const output = ContentService.createTextOutput(JSON.stringify({
      success: true,
      action: action,
      bookId: scannedId,
      title: title,
      borrower: borrower,
      newStatus: newStatus,
      message: `${action}: ${scannedId} (${title}) by ${borrower}`
    })).setMimeType(ContentService.MimeType.JSON);
    return setCorsHeaders(output);

  } catch (err: any) {
    const errorOutput = ContentService.createTextOutput(JSON.stringify({ success: false, message: `Error: ${err.message}` }))
      .setMimeType(ContentService.MimeType.JSON);
    return setCorsHeaders(errorOutput);
  }
}