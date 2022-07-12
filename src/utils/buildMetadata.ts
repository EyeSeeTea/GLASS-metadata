import _ from "lodash";
import { MetadataItem } from "../domain/entities/MetadataItem";
import { Sheet } from "../domain/entities/Sheet";

// Return an object containing the metadata representation of all the sheets
// that are included in the spreadsheet.
export function buildMetadata(sheets: Sheet[], defaultCC: string) {
    const get = (name: string) => getItems(sheets, name); // shortcut

    const sheetDataSets = get("dataSets"),
        sheetDataElements = get("dataElements"),
        sheetDataSetSections = get("sections"),
        sheetCategoryCombos = get("categoryCombos"),
        sheetCategoryOptions = get("categoryOptions"),
        sheetCategories = get("categories"),
        sheetOptionSets = get("optionSets"),
        sheetOptions = get("options"),
        sheetTrackedEntityAttributes = get("trackedEntityAttributes"),
        sheetTrackedEntityTypes = get("trackedEntityTypes"),
        sheetProgramDataElements = get("programDataElements");

    const options = _(sheetOptions)
        .map(option => {
            const optionSet = sheetOptionSets.find(({ name }) => name === option.optionSet)?.id;

            return { ...option, optionSet: { id: optionSet } };
        })
        .groupBy(({ optionSet }) => optionSet.id)
        .mapValues(options => options.map((option, index) => ({ ...option, sortOrder: index + 1 })))
        .values()
        .flatten()
        .value();

    const sections = _(sheetDataSetSections)
        .map(section => {
            const dataSet = sheetDataSets.find(({ name }) => name === section.dataSet)?.id;
            const dataElements = sheetDataElements
                .filter(({ dataSetSection }) => dataSetSection === section.name)
                .map(({ id }) => ({ id }));

            return { ...section, dataSet: { id: dataSet }, dataElements };
        })
        .groupBy(({ dataSet }) => dataSet.id)
        .mapValues(items => items.map((section, index) => ({ ...section, sortOrder: index + 1 })))
        .values()
        .flatten()
        .value();

    const dataElements = sheetDataElements.map(dataElement => {
        const categoryCombo =
            sheetCategoryCombos.find(({ name }) => name === dataElement.categoryCombo)?.id ?? defaultCC;

        const optionSet = sheetOptionSets.find(({ name }) => name === dataElement.optionSet)?.id;

        return {
            ...dataElement,
            categoryCombo: { id: categoryCombo },
            optionSet: optionSet ? { id: optionSet } : undefined,
            domainType: "AGGREGATE",
        };
    });

    const dataSets = sheetDataSets.map(dataSet => {
        const dataSetElements = sheetDataElements
            .filter(({ dataSetSection }) => {
                const section = sheetDataSetSections.find(({ name }) => name === dataSetSection);
                return section?.dataSet === dataSet.name;
            })
            .map(({ id, categoryCombo }) => {
                const categoryComboId = sheetCategoryCombos.find(({ name }) => name === categoryCombo)?.id ?? defaultCC;

                return {
                    dataSet: { id: dataSet.id },
                    dataElement: { id },
                    categoryCombo: { id: categoryComboId },
                };
            });

        const categoryCombo = sheetCategoryCombos.find(({ name }) => name === dataSet.categoryCombo)?.id ?? defaultCC;

        return { ...dataSet, dataSetElements, categoryCombo: { id: categoryCombo } };
    });

    const categories = sheetCategories.map(category => {
        const categoryOptions = sheetCategoryOptions
            .filter(option => option.category === category.name)
            .map(({ id }) => ({ id }));

        return { ...category, categoryOptions };
    });

    const categoryCombos = sheetCategoryCombos.map(categoryCombo => {
        const categories = sheetCategories
            .filter(category => category.categoryCombo === categoryCombo?.name)
            .map(({ id }) => ({ id }));

        return { ...categoryCombo, categories };
    });

    const optionSets = sheetOptionSets.map(optionSet => {
        const options = sheetOptions.filter(option => option.optionSet === optionSet.name).map(({ id }) => ({ id }));

        return { ...optionSet, options };
    });

    const categoryOptions = _.uniqBy(sheetCategoryOptions, item => item.id);

    const trackedEntityAttributes: any[] = sheetTrackedEntityAttributes.map(attribute => {
        const optionSet = sheetOptionSets.find(({ name }) => name === attribute.optionSet)?.id;

        return {
            ...attribute,
            optionSet: optionSet ? { id: optionSet } : undefined,
        };
    });

    const trackedEntityTypes = sheetTrackedEntityTypes.map(type => {
        const trackedEntityTypeAttributes = trackedEntityAttributes
            .filter(({ trackedEntityType }) => trackedEntityType === type.name)
            .map(({ id, name, searchable, mandatory, unique, valueType, displayInList, optionSet }) => ({
                value: id,
                text: name,
                searchable,
                mandatory,
                unique,
                valueType,
                displayInList,
                trackedEntityAttribute: { id },
                optionSet,
            }));

        return { ...type, trackedEntityTypeAttributes };
    });

    const programDataElements = sheetProgramDataElements.map(dataElement => {
        const optionSet = sheetOptionSets.find(({ name }) => name === dataElement.optionSet)?.id;

        return {
            ...dataElement,
            domainType: "TRACKER",
            optionSet: optionSet ? { id: optionSet } : undefined,
        };
    });

    return {
        dataSets,
        dataElements: [...dataElements, ...programDataElements],
        options,
        sections,
        categories,
        categoryCombos,
        categoryOptions,
        optionSets,
        trackedEntityAttributes,
        trackedEntityTypes,
        programSections: buildprogramSections(sheets),
        programs: buildPrograms(sheets),
        programStages: buildProgramStages(sheets),
        programStageSections: buildProgramStageSections(sheets),
        programRules: buildProgramRules(sheets),
        programRuleActions: buildProgramRuleActions(sheets),
        programRuleVariables: buildProgramRuleVariables(sheets),
    };
}

function buildPrograms(sheets: Sheet[]) {
    const get = (name: string) => getItems(sheets, name);

    const programs = get("programs");
    const pSections = get("programSections");
    const pStages = get("programStages");
    const trackedEntityTypes = get("trackedEntityTypes");
    const categoryCombos = get("categoryCombos");

    return programs.map(program => {
        let data = { ...program } as MetadataItem;

        const trackedEntityType = {
            id: getByName(trackedEntityTypes, program.trackedEntityType)?.id
        };

        const programStages = pStages.filter((pStageToFilter) => {
            return pStageToFilter.program === program.name;
        }).map(programStage => ({ id: programStage.id }));

        replaceById(data, "categoryCombo", categoryCombos);

        if (trackedEntityType.id) {
            // WITH_REGISTRATION == Tracker Program
            const programType = "WITH_REGISTRATION";

            replaceById(data, "relatedProgram", programs);

            // Event Program Stages belong to programStageSections
            const programSections = pSections.filter((pSectionToFilter) => {
                return pSectionToFilter?.program === program.name;
            }).map(programSection => ({ id: programSection.id }));

            return { ...data, programType, trackedEntityType, programStages, programSections };
        } else {
            // WITHOUT_REGISTRATION == Event Program
            const programType = "WITHOUT_REGISTRATION";
            return { ...data, programType, programStages };
        }
    });
}

function buildprogramSections(sheets: Sheet[]) {
    const get = (name: string) => getItems(sheets, name);

    const programSections = _.cloneDeep(get("programSections"));
    const programs = get("programs");
    const teAttributes = get("trackedEntityAttributes");

    const sectionsAttributes = get("programSectionsTrackedEntityAttributes").map(psTrackedEntityAttribute => {
        const programSection = programSections.find(pSectionToFind => {
            return pSectionToFind.name === psTrackedEntityAttribute.programSection &&
                pSectionToFind.program === psTrackedEntityAttribute.program
        })?.id;

        const trackedEntityAttribute = getByName(teAttributes, psTrackedEntityAttribute.name)?.id;

        return { programSection, trackedEntityAttribute }
    });

    return programSections.map(programSection => {
        const program = {
            id: getByName(programs, programSection.program)?.id
        };

        if (programSection.sortOrder === undefined) {
            addSortOrder(programSections.filter((pSectionToFilter) => {
                return pSectionToFilter.program === programSection.program;
            }));
        }

        const renderType = addRenderType(programSection, "LISTING");

        const trackedEntityAttributes = sectionsAttributes.filter((sectionsAttributeToFilter) => {
            return sectionsAttributeToFilter?.programSection === programSection.id;
        }).map(sectionsAttribute => ({ id: sectionsAttribute.trackedEntityAttribute }));

        return { ...programSection, program, renderType, trackedEntityAttributes }
    });
}

function buildProgramStages(sheets: Sheet[]) {
    const get = (name: string) => getItems(sheets, name);

    const programStages = get("programStages");
    const programs = get("programs");
    const psSections = get("programStageSections");
    const psDataElements = get("programStageDataElements");
    const programDataElements = get("programDataElements");

    return programStages.map(programStage => {
        const program = {
            id: getByName(programs, programStage.program)?.id
        };

        const programStageSections = psSections.filter((psSectionToFilter) => {
            return psSectionToFilter?.programStage === programStage.name &&
                psSectionToFilter?.program === programStage.program;
        }).map(psSection => ({ id: psSection.id }));

        const programStageDataElements = psDataElements.filter((psDataElementToFilter) => {
            return psDataElementToFilter?.program === programStage.program &&
                psDataElementToFilter?.programStage === programStage.name;
        }).map((data, index) => ({
            id: data.id,
            programStage: {
                id: programStage.id
            },
            sortOrder: index,
            compulsory: data.compulsory,
            allowProvidedElsewhere: data.allowProvidedElsewhere,
            displayInReports: data.displayInReports,
            allowFutureDate: data.allowFutureDate,
            skipSynchronization: data.skipSynchronization,
            renderType: addRenderType(data, "DEFAULT"),
            dataElement: {
                id: getByName(programDataElements, data.name)?.id
            },
        }));

        return { ...programStage, program, programStageDataElements, programStageSections }
    });
}

function buildProgramStageSections(sheets: Sheet[]) {
    const get = (name: string) => getItems(sheets, name);

    const programStageSections = _.cloneDeep(get("programStageSections"));
    const programStages = get("programStages");
    const pssDataElements = get("programStageSectionsDataElements");
    const programDataElements = get("programDataElements");

    const programStageSectionsDataElements = pssDataElements.map(pssDataElement => {
        const programStageSection = programStageSections.find(
            psSectionToFind => {
                return psSectionToFind.name === pssDataElement.programStageSection &&
                    psSectionToFind.programStage === pssDataElement.programStage &&
                    psSectionToFind.program === pssDataElement.program
            }
        )?.id;

        const dataElement = getByName(programDataElements, pssDataElement.name)?.id;

        return { programStageSection, dataElement }
    });

    return programStageSections.map(programStageSection => {
        const programStage = {
            id: getByName(programStages, programStageSection.programStage)?.id
        };

        if (typeof programStageSection.sortOrder === 'undefined') {
            addSortOrder(programStageSections.filter((psSectionToFilter) => {
                return psSectionToFilter.program === programStageSection.program &&
                    psSectionToFilter.programStage === programStageSection.programStage
            }));
        }

        const renderType = addRenderType(programStageSection, "LISTING");

        const dataElements = programStageSectionsDataElements.filter((pssDataElementToFilter) => {
            return pssDataElementToFilter?.programStageSection === programStageSection?.id;
        }).map(pssDataElement => ({ id: pssDataElement.dataElement }));

        delete programStageSection.program;

        return { ...programStageSection, programStage, renderType, dataElements }
    });
}

function buildProgramRules(sheets: Sheet[]) {
    const rules = getItems(sheets, "programRules");
    const programs = getItems(sheets, "programs");
    const actions = getItems(sheets, "programRuleActions");

    return rules.map(rule => {
        const program = getByName(programs, rule.program);

        const programRuleActions = actions
            .filter(action => action.programRule === rule.name)
            .map(action => ({ id: action.id }));

        return { ...rule, program: { id: program.id }, programRuleActions };
    });
}

function buildProgramRuleActions(sheets: Sheet[]) {
    const get = (name: string) => getItems(sheets, name); // shortcut

    const actions = get("programRuleActions"),
        rules = get("programRules"),
        elements = get("programDataElements"),
        attrs = get("trackedEntityAttributes"),
        stages = get("programStages"),
        sections = get("programStageSections");

    return actions.map(action => {
        let data = { ...action } as MetadataItem; // copy that we will modify

        replaceById(data, "programRule", rules);
        replaceById(data, "dataElement", elements);
        replaceById(data, "trackedEntityAttribute", attrs);
        replaceById(data, "programStage", stages);
        replaceById(data, "programStageSection", sections);

        return data;
    });
}

function buildProgramRuleVariables(sheets: Sheet[]) {
    const get = (name: string) => getItems(sheets, name); // shortcut

    const vars = get("programRuleVariables"),
        programs = get("programs"),
        elements = get("programDataElements"),
        attrs = get("trackedEntityAttributes"),
        stages = get("programStages");

    return vars.map(variable => {
        let data = { ...variable } as MetadataItem; // copy that we will modify

        replaceById(data, "program", programs);
        replaceById(data, "dataElement", elements);
        replaceById(data, "trackedEntityAttribute", attrs);
        replaceById(data, "programStage", stages);

        return data;
    });
}

// Add sortOrder to filteredMetadataItems, these items belong to the same 'group'.
// The idea is to use metadataItems.filter(filterFunction) as filteredMetadataItems.
function addSortOrder(filteredMetadataItems: MetadataItem[]) {
    filteredMetadataItems.forEach((item, index) => {
        item.sortOrder = index;
    });
}

// Adds renderType to a metadata object with a default fallback value
function addRenderType(metadataItem: MetadataItem, defaultValue: string) {
    const renderType = {
        DESKTOP: { type: metadataItem.renderTypeDesktop ?? defaultValue },
        MOBILE: { type: metadataItem.renderTypeMobile ?? defaultValue }
    };
    delete metadataItem.renderTypeDesktop;
    delete metadataItem.renderTypeMobile;

    return renderType;
}

// Return all the items (rows) from the sheet with the given name.
function getItems(sheets: Sheet[], name: string) {
    return sheets.find(sheet => sheet.name === name)?.items ?? [];
}

// Return the item from the list that has the given name.
function getByName(items: MetadataItem[], name: string): MetadataItem {
    return items.find(item => item.name === name) ?? {};
}

// Modify data[key], so instead of data[key]=name, it becomes data[key]={id: id}
// with the id of the item in items that had that name.
function replaceById(data: MetadataItem, key: string, items: MetadataItem[]) {
    if (key in data) {
        const name = data[key];
        const item = getByName(items, name);
        data[key] = { id: item.id };
    }
}
