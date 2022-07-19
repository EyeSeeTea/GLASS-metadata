// Pull IDs from DHIS2 Instance script.

import { D2Api } from "@eyeseetea/d2-api/2.34";
import { config } from "dotenv-flow";
import { google } from "googleapis";
import _ from "lodash";
import { MetadataItem } from "../domain/entities/MetadataItem";
import { Sheet } from "../domain/entities/Sheet";
import { getUid } from "../utils/uid";
import { pullMetadata } from "../utils/pullMetadata";

async function download_ids() {
    config(); // fill variable process.env from ".env.*" files
    const log = console.log,
        env = process.env; // shortcuts

    log(`Reading https://docs.google.com/spreadsheets/d/${env.GOOGLE_SHEET_ID} ...`);
    const { spreadsheets } = google.sheets({ version: "v4", auth: env.GOOGLE_API_KEY });

    const { data } = await spreadsheets.get({ spreadsheetId: env.GOOGLE_SHEET_ID, includeGridData: true });
    const sheets = data.sheets?.filter(sheet => sheet.properties?.title != "DHIS2").map(loadSheet) ?? [];

    const api = new D2Api({
        baseUrl: env.DHIS2_BASE_URL,
        auth: { username: env.DHIS2_USERNAME ?? "", password: env.DHIS2_PASSWORD ?? "" },
    });

    pullMetadata(api, sheets);
}

// Return an object with the name of the sheet and a list of items that
// correspond to each row. The items are objects like { col1: v1, col2: v2, ... }
// and a generated id if they don't contain one already.
function loadSheet(sheet: any): Sheet {
    const sheetName = sheet.properties.title;

    const data = _.flatMap(sheet.data, data =>
        _.map(data.rowData, row => _.flatMap(row.values, cell => cell.formattedValue ?? undefined))
    );

    const header = data[0];
    const rows = data.slice(1);

    const items = rows
        .map(row => _.fromPairs(row.map((value, index) => [header[index], value]).filter(([, value]) => value)))
        .filter(item => !_.isEmpty(item))
        .map(item => ({ ...item, id: item.id ?? getUid(makeSeed(item, sheetName)) } as MetadataItem));

    if (!items.every(item => item.name)) throw Error(`Rows with no name in sheet ${sheetName}`);

    return { name: sheetName, items };
}

// Return a string that can be used as a seed to generate a uid, corresponding
// to the given item at the given page in the spreadsheet.
function makeSeed(item: MetadataItem, sheetName: string) {
    const seed0 = `${sheetName}-${item.name}`; // the seed will be at least the page and the item's name
    if (sheetName === "options") return `${seed0}-${item.optionSet}`;
    if (sheetName === "programs") return `${seed0}-${item.program}`;
    if (sheetName === "programSections") return `${seed0}-${item.program}`;
    if (sheetName === "programStages") return `${seed0}-${item.program}`;
    if (sheetName === "programStageSections") return `${seed0}-${item.programStage}`;
    if (sheetName === "programStageDataElements") return `${seed0}-${item.program}-${item.programStage}`;
    return seed0;
}

download_ids();
