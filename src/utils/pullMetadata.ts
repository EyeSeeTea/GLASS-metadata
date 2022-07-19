import { D2Api } from "@eyeseetea/d2-api/2.34";
import _ from "lodash";
import { MetadataItem } from "../domain/entities/MetadataItem";
import { Sheet } from "../domain/entities/Sheet";
import { createObjectCsvWriter } from "csv-writer";

const log = console.log, env = process.env;

type MetadataQuery = { [key: string]: any };
type FilterNames = { [key: string]: string[] };

const allowedTypesArray = [
    "programSections", "programs", "programStages", "programStageSections",
    "trackedEntityTypes", "trackedEntityAttributes", "programRules",
    "programRuleActions", "programRuleVariables", "dataElements", "dataSets",
    "sections", "Categories", "categoryCombos", "categoryOptions", "optionSets", "options"
]

// Get names from spreadsheet data
function getNamesFromSpreadsheet(sheets: Sheet[]) {
    let filterNames: FilterNames = {};

    sheets.forEach((sheet) => {
        if (sheet.items.length !== 0) {
            filterNames[sheet.name] = [];
            sheet.items.forEach((item) => {
                filterNames[sheet.name].push(item["name"]);
            })
        }
    });

    return filterNames;
}

// Make the appropriate query from the template for one metadata type
function makeMetadataItemQuery(itemType: string, namesToFilter?: string[]) {
    let query: MetadataQuery = {};
    query[itemType] = {
        fields: {
            id: true,
        }
    };

    if (typeof namesToFilter !== undefined || namesToFilter?.length !== 0) {
        query[itemType]["filter"] = { name: { in: namesToFilter } };
    }
    return query;
}

// Make filtered query for each type present in names
function makeQueries(allowedTypesArray: string[], names: FilterNames) {
    let queries: { type: string, value: MetadataQuery }[] = []

    Object.entries(names).forEach(([metadataItemType, nameArray]) => {
        if (allowedTypesArray.includes(metadataItemType)) {
            queries.push({
                type: metadataItemType,
                value: makeMetadataItemQuery(metadataItemType, nameArray)
            });
        }
    });

    return queries;
}

function makeCsvHeader(element: object) {
    const keys = Object.keys(element).filter(key => key !== "id");
    let csvHeaders: { id: string; title: string; }[] = [{
        id: "id",
        title: "id"
    }];

    keys.forEach(headerItem => {
        if (keys.includes(headerItem)) {
            csvHeaders.push({
                id: headerItem,
                title: headerItem
            })
        }
    })

    return csvHeaders;
}

function writeCsv(metadataType: string, metadata: [object]) {
    const filePath = `${env.PULL_METADATA_CSV_PATH}${metadataType}.csv`;

    const header = makeCsvHeader(metadata[0]);

    const Writer = createObjectCsvWriter({ path: filePath, header });

    Writer.writeRecords(metadata);
    console.debug(`Written: ${filePath}`);
}

export async function pullMetadata(api: D2Api, sheets: Sheet[]) {
    const filterNames = getNamesFromSpreadsheet(sheets);

    const queries = makeQueries(allowedTypesArray, filterNames);

    queries.forEach(async (query) => {
        const metadata = await api.metadata.get(query.value).getData().then(results => {
            let resultsAsMetadataItem = _.omit(results, "system") as MetadataItem;
            return resultsAsMetadataItem[query.type];
        })

        if (metadata.length !== 0) {
            writeCsv(query.type, metadata);
        }
    })
}
