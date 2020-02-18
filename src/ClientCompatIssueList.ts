import Issue from "./Issue";

class ClientCompatIssueList {

    private m_global: Map<string, Issue | Issue[]> =
        new Map<string, Issue | Issue[]>();

    private m_properties: Map<string, Map<string, Issue | Issue[]>> =
        new Map<string, Map<string, Issue | Issue[]>>();

    private m_events: Map<string, Map<string, Issue | Issue[]>> =
        new Map<string, Map<string, Issue | Issue[]>>();

    public setIssuesForGlobal(name: string, issues: readonly Issue[]): void {
        if (issues.length === 0) {
            return;
        }
        if (issues.length === 1) {
            this.m_global.set(name, issues[0]);
        }
        else {
            this.m_global.set(name, issues.slice());
        }
    }

    public setIssuesForPropertyOrEvent(
        typeName: string, propName: string, isEvent: boolean, issues: readonly Issue[]): void
    {
        if (issues.length === 0) {
            return;
        }

        const dict = isEvent ? this.m_events : this.m_properties;
        let typeDict = dict.get(typeName);
        if (typeDict === undefined) {
            typeDict = new Map<string, Issue | Issue[]>();
            dict.set(typeName, typeDict);
        }
        if (issues.length === 1) {
            typeDict.set(propName, issues[0]);
        }
        else {
            typeDict.set(propName, issues.slice());
        }
    }

    public getIssuesForGlobal(name: string, issues: Issue[]): void {
        const issuesFound = this.m_global.get(name);
        if (issuesFound === undefined) {
            return;
        }
        if (Array.isArray(issuesFound)) {
            issues.push.apply(issues, issuesFound as Issue[]);
        }
        else {
            issues.push(issuesFound as Issue);
        }
    }

    public getIssuesForPropertyOrEvent(
        typeName: string, propName: string, isEvent: boolean, issues: Issue[]): void
    {
        const dict = isEvent ? this.m_events : this.m_properties;
        const typeDict = dict.get(typeName);
        if (typeDict === undefined) {
            return;
        }
        const issuesFound = typeDict.get(propName);
        if (issuesFound === undefined) {
            return;
        }
        if (Array.isArray(issuesFound)) {
            issues.push.apply(issues, issuesFound as Issue[]);
        }
        else {
            issues.push(issuesFound as Issue);
        }
    }

}

export default ClientCompatIssueList;
