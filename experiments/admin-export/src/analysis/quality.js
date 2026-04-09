function confidenceFromLevel(level) {
    if (level === "high") {
        return { label: "High confidence", tone: "default" };
    }
    if (level === "medium") {
        return { label: "Medium confidence", tone: "default" };
    }
    return { label: "Low confidence", tone: "caution" };
}

export function assessSectionConfidence(sessionData, findings) {
    const quality = sessionData.quality || {};
    const warningsCount = quality.warnings?.length || 0;
    const hasFullBoardResults = quality.hasTravellerLines;
    const hasDd = quality.hasDd;
    const hasLeads = sessionData.boards?.some((board) => board.results.some((result) => String(result.lead || "").trim() !== "")) || false;

    return {
        summary: confidenceFromLevel(warningsCount > 1 ? "medium" : "high"),
        materialBoards: confidenceFromLevel(hasFullBoardResults ? "high" : "low"),
        winnerPattern: confidenceFromLevel(hasFullBoardResults ? "high" : "low"),
        contractSplit: confidenceFromLevel(findings.contractSplit && hasFullBoardResults ? "high" : "low"),
        sameContractSwing: confidenceFromLevel(findings.playSwing && hasFullBoardResults ? "high" : "low"),
        leadDifference: confidenceFromLevel(findings.leadSwing && hasLeads ? "medium" : "low"),
        pairSnapshot: confidenceFromLevel(hasFullBoardResults ? "high" : "medium"),
    };
}
