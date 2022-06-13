import fs from "fs";
import { D2Api } from "@eyeseetea/d2-api/2.34";
import _ from "lodash";
import { MetadataItem } from "../domain/entities/MetadataItem";
import { Sheet } from "../domain/entities/Sheet";
import { createObjectCsvWriter } from "csv-writer";

const log = console.log, env = process.env;

type MetadataQuery = { [key: string]: any };
type QueryTemplateArray = { type: string, template: MetadataQuery }[];
type FilterNames = { [key: string]: string[] };
// type FilterNames = { type: string, names: string[] }[];

const queryTemplates: QueryTemplateArray = [
    {
        type: "programSections",
        template: {
            programSections: {
                fields: {
                    id: true,
                    name: true,
                    description: true,
                    renderType: true,
                    program: true,
                    trackedEntityAttributes: true,
                }
            }
        },
    },
    {
        type: "programs",
        template: {
            programs: {
                fields: {
                    id: true,
                    name: true,
                    shortName: true,
                    code: true,
                    description: true,
                    trackedEntityType: true,
                    version: true,
                    expiryPeriodType: true,
                    expiryDays: true,
                    completeEventsExpiryDays: true,
                    displayFrontPageList: true,
                    useFirstStageDuringRegistration: true,
                    accessLevel: true,
                    minAttributesRequiredToSearch: true,
                    maxTeiCountToReturn: true,
                    selectIncidentDatesInFuture: true,
                    selectEnrollmentDatesInFuture: true,
                    onlyEnrollOnce: true,
                    displayIncidentDate: true,
                    incidentDateLabel: true,
                    enrollmentDateLabel: true,
                    ignoreOverdueEvents: true,
                    featureType: true,
                    relatedProgram: true,
                    categoryCombo: true,
                    programSections: true,
                    programStages: true,
                },
            },
        }
    },
    {
        type: "programStages",
        template: {
            programStages: {
                fields: {
                    id: true,
                    name: true,
                    program: true,
                    enableUserAssignment: true,
                    blockEntryForm: true,
                    featureType: true,
                    preGenerateUID: true,
                    executionDateLabel: true,
                    validationStrategy: true,
                    description: true,
                    minDaysFromStart: true,
                    repeatable: true,
                    periodType: true,
                    displayGenerateEventBox: true,
                    standardInterval: true,
                    autoGenerateEvent: true,
                    openAfterEnrollment: true,
                    reportDateToUse: true,
                    remindCompleted: true,
                    allowGenerateNextVisit: true,
                    generatedByEnrollmentDate: true,
                    hideDueDate: true,
                    dueDateLabel: true,
                    programStageDataElements: true,
                    programStageSections: true,
                },
            },
        },
    },
    {
        type: "programStageSections",
        template: {
            programStageSections: {
                fields: {
                    id: true,
                    programStage: true,
                    name: true,
                    renderType: true,
                    sortOrder: true,
                    description: true,
                    dataElements: true,
                },
            },
        },
    },
    {
        type: "trackedEntityTypes",
        template: {
            trackedEntityTypes: {
                fields: {
                    id: true,
                    name: true,
                    description: true,
                    allowAuditLog: true,
                    featureType: true,
                    minAttributesRequiredToSearch: true,
                    trackedEntityTypeAttributes: true,
                    attributeValues: true,
                },
            },
        },
    },
    {
        type: "trackedEntityAttributes",
        template: {
            trackedEntityAttributes: {
                fields: {
                    id: true,
                    name: true,
                    shortName: true,
                    formName: true,
                    code: true,
                    description: true,
                    fieldMask: true,
                    optionSetValue: true,
                    optionSet: true,
                    valueType: true,
                    aggregationType: true,
                    unique: true,
                    orgunitScope: true,
                    generated: true,
                    pattern: true,
                    inherit: true,
                    confidential: true,
                    displayInListNoProgram: true,
                    skipSynchronization: true,
                    legendSet: true,
                    legendSets: true,
                },
            },
        },
    },
    {
        type: "programRules",
        template: {
            programRules: {
                fields: {
                    id: true,
                    name: true,
                    description: true,
                    program: true,
                    condition: true,
                    programRuleActions: true,
                },
            },
        },
    },
    {
        type: "programRuleActions",
        template: {
            programRuleActions: {
                fields: {
                    id: true,
                    name: true,
                    programRule: true,
                    programRuleActionType: true,
                    content: true,
                    data: true,
                    location: true,
                    dataElement: true,
                    trackedEntityAttribute: true,
                },
            },
        },
    },
    {
        type: "programRuleVariables",
        template: {
            programRuleVariables: {
                fields: {
                    id: true,
                    name: true,
                    displayName: true,
                    program: true,
                    useCodeForOptionSet: true,
                    programRuleVariableSourceType: true,
                    dataElement: true,
                    trackedEntityAttribute: true,
                    programStage: true,
                },
            },
        },
    },
    {
        type: "dataElements",
        template: {
            dataElements: {
                fields: {
                    id: true,
                    name: true,
                    shortName: true,
                    formName: true,
                    dataSetSection: true,
                    code: true,
                    categoryCombo: true,
                    valueType: true,
                    aggregationType: true,
                    domainType: true,
                    description: true,
                    optionSet: {
                        id: true,
                    },
                },
            },
        }
    },
    {
        type: "dataSets",
        template: {
            dataSets: {
                fields: {
                    id: true,
                    name: true,
                    code: true,
                    periodType: true,
                    categoryCombo: true,
                    description: true,
                },
            },
        },
    },
    {
        type: "sections",
        template: {
            sections: {
                fields: {
                    id: true,
                    name: true,
                    code: true,
                    dataSet: {
                        id: true,
                    },
                    showRowTotals: true,
                    showColumnTotals: true,
                    description: true,
                },
            },

        }
    },
    {
        type: "Categories",
        template: {
            Categories: {
                fields: {
                    id: true,
                    name: true,
                    shortName: true,
                    code: true,
                    categoryCombo: {
                        id: true,
                    },
                    dataDimensionType: true,
                    description: true
                },
            },
        }
    },
    {
        type: "categoryCombos",
        template: {
            categoryCombos: {
                fields: {
                    id: true,
                    name: true,
                    code: true,
                    dataDimensionType: true,
                    description: true,
                },
            },
        }
    },
    {
        type: "categoryOptions",
        template: {
            categoryOptions: {
                fields: {
                    id: true,
                    name: true,
                    code: true,
                    category: {
                        id: true,
                    },
                    shortName: true,
                    description: true,
                },
            },
        }
    },
    {
        type: "optionSets",
        template: {
            optionSets: {
                fields: {
                    id: true,
                    name: true,
                    code: true,
                    valueType: true,
                    description: true,
                },
            },
        }
    },
    {
        type: "options",
        template: {
            options: {
                fields: {
                    id: true,
                    name: true,
                    code: true,
                    optionSet: {
                        id: true,
                    },
                    shortName: true,
                    description: true,
                },
            },
        }
    },
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
function makeMetadataItemQuery(queryTemplate: MetadataQuery, namesToFilter?: string[], uidOnly?: boolean) {
    const key = Object.keys(queryTemplate)[0];
    let metadataQuery: MetadataQuery = {};

    if (uidOnly) {
        metadataQuery[key] = { fields: { id: queryTemplate[key]["fields"]["id"] } };
    } else {
        metadataQuery[key] = { fields: queryTemplate[key]["fields"] };
    }
    if (typeof namesToFilter !== undefined || namesToFilter?.length !== 0) {
        metadataQuery[key]["filter"] = { name: { in: namesToFilter } };
    }
    return metadataQuery;
}

// Make filtered query for each type present in names
function makeFilteredQueries(queryTemplates: QueryTemplateArray, names: FilterNames, uidOnly?: boolean) {
    let queries: { type: string, value: MetadataQuery }[] = []

    Object.entries(names).forEach(([metadataItemType, nameArray]) => {
        const queryTemplate = queryTemplates.find(queryTemplate => {
            return queryTemplate.type === metadataItemType;
        })?.template ?? undefined;

        if (queryTemplate !== undefined) {
            queries.push({
                type: metadataItemType,
                value: makeMetadataItemQuery(queryTemplate, nameArray, uidOnly)
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

export async function getMetadata(api: D2Api, sheets: Sheet[], uidOnly?: boolean) {
    const filterNames = getNamesFromSpreadsheet(sheets);

    const queries = makeFilteredQueries(queryTemplates, filterNames, uidOnly);

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
