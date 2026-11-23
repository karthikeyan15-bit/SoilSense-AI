import PDFDocument from 'pdfkit';
import type {
  Farm,
  FertilizerRecommendationRecord,
  SoilAnalysisRecord,
  UserProfile,
} from '../../shared/types.js';

export function buildAdvisoryPdfBuffer(params: {
  farmer: UserProfile;
  farm: Farm;
  analysis: SoilAnalysisRecord;
  recommendation?: FertilizerRecommendationRecord | null;
  reportTitle: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const forest = '#1E4631';
    const ink = '#18231C';
    const muted = '#556159';
    const border = '#D8D2C7';

    // Header Banner
    doc.rect(0, 0, doc.page.width, 86).fill(forest);
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('SoilSense AI', 48, 24);
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#DDE8E0')
      .text('Soil Health Assessment & Deterministic ICAR/FCO Fertilizer Advisory Report', 48, 50);
    doc
      .fontSize(9)
      .text(`Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 48, 65);

    doc.moveDown(2.2);
    doc.fillColor(ink);

    // Section 1: Farmer & Farm Details
    doc.fontSize(13).font('Helvetica-Bold').fillColor(forest).text('1. Farmer & Farm Profile', 48, 108);
    doc.moveTo(48, 125).lineTo(547, 125).strokeColor(border).lineWidth(1).stroke();

    doc.fontSize(10).font('Helvetica').fillColor(ink);
    const metaY = 134;
    doc.text(`Farmer Name: ${params.farmer.name}`, 48, metaY);
    doc.text(`Contact / Email: ${params.farmer.email}${params.farmer.phone ? ` · ${params.farmer.phone}` : ''}`, 48, metaY + 15);
    doc.text(`Farm Name: ${params.farm.farmName}`, 48, metaY + 30);
    doc.text(`Location: ${params.farm.village}, ${params.farm.district}, ${params.farm.state}`, 48, metaY + 45);

    doc.text(`Selected Crop: ${params.analysis.crop} (${params.farm.cropSeason})`, 315, metaY);
    doc.text(`Growth Stage: ${params.farm.growthStage}`, 315, metaY + 15);
    doc.text(`Land Area: ${params.farm.landArea} ${params.farm.areaUnit} (${params.farm.areaHectares} ha)`, 315, metaY + 30);
    doc.text(`Lab / Sample Date: ${params.analysis.labName} (${params.analysis.sampleDate})`, 315, metaY + 45);

    // Section 2: Verified Soil Test Results
    doc.y = metaY + 75;
    doc.fontSize(13).font('Helvetica-Bold').fillColor(forest).text('2. Verified Soil Test Values & ICAR Assessment');
    doc.moveTo(48, doc.y + 3).lineTo(547, doc.y + 3).strokeColor(border).stroke();
    doc.moveDown(0.5);

    doc.fontSize(9.5).font('Helvetica').fillColor(ink).text(params.analysis.overallHealthSummary, { width: 500 });
    doc.moveDown(0.6);

    // Table header
    const startY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(muted);
    doc.text('Parameter', 48, startY);
    doc.text('Lab Value & Unit', 210, startY);
    doc.text('ICAR Threshold', 320, startY);
    doc.text('Status', 460, startY);
    doc.moveTo(48, startY + 13).lineTo(547, startY + 13).strokeColor(border).stroke();

    let rowY = startY + 18;
    const testedAssessments = params.analysis.assessments.filter((a) => a.status !== 'Missing');
    doc.font('Helvetica').fontSize(9);

    for (const a of testedAssessments) {
      if (rowY > 740) {
        doc.addPage();
        rowY = 56;
      }
      doc.fillColor(ink).text(a.label, 48, rowY, { width: 155 });
      doc.text(`${a.measuredValue} ${a.unit}`, 210, rowY, { width: 105 });
      doc.fillColor(muted).text(a.thresholdRange, 320, rowY, { width: 135 });
      const statusColor =
        a.status === 'Deficient' || a.status === 'Low' || a.status === 'Saline'
          ? '#B91C1C'
          : a.status === 'Alkaline' || a.status === 'Acidic' || a.status === 'High' || a.status === 'Excess'
            ? '#B45309'
            : '#15803D';
      doc.fillColor(statusColor).font('Helvetica-Bold').text(a.status, 460, rowY);
      doc.font('Helvetica');
      rowY += 16;
    }

    if (params.analysis.missingParameters.length > 0) {
      rowY += 4;
      doc
        .fontSize(8.5)
        .fillColor(muted)
        .text(`Parameters not tested in this lab sample: ${params.analysis.missingParameters.join(', ')}`, 48, rowY, {
          width: 500,
        });
      rowY += 18;
    }

    // Section 3: Deterministic Fertilizer Recommendation
    doc.y = rowY + 12;
    if (doc.y > 650) {
      doc.addPage();
    }

    doc.fontSize(13).font('Helvetica-Bold').fillColor(forest).text('3. Deterministic Fertilizer Recommendation');
    doc.moveTo(48, doc.y + 3).lineTo(547, doc.y + 3).strokeColor(border).stroke();
    doc.moveDown(0.5);

    if (!params.recommendation) {
      doc
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor(muted)
        .text('No fertilizer plan was attached to this report. Generate a fertilizer plan from the Fertilizer Recommendation page.');
    } else if (params.recommendation.status === 'expert_review_required') {
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#B91C1C')
        .text('EXPERT REVIEW REQUIRED — NO VALIDATED REGIONAL DOSE INVENTED');
      doc
        .moveDown(0.3)
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor(ink)
        .text(params.recommendation.expertReviewReason ?? '', { width: 500 });
      if (params.recommendation.missingInformation?.length) {
        doc.moveDown(0.3);
        for (const msg of params.recommendation.missingInformation) {
          doc.text(`• ${msg}`, { width: 500 });
        }
      }
    } else {
      const rec = params.recommendation;
      doc
        .fontSize(9.5)
        .font('Helvetica')
        .fillColor(ink)
        .text(`Method: ${rec.calculationMethod}`);
      doc.text(
        `Adjusted Nutrient Targets (kg/ha): N = ${rec.targetsKgPerHa.N} kg/ha  |  P2O5 = ${rec.targetsKgPerHa.P2O5} kg/ha  |  K2O = ${rec.targetsKgPerHa.K2O} kg/ha`,
      );
      if (rec.targetYieldNote) {
        doc.fillColor(muted).text(`Reference Target Yield: ${rec.targetYieldNote}`);
      }
      doc.moveDown(0.6);

      const fHeadY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(muted);
      doc.text('Fertilizer Product (FCO)', 48, fHeadY);
      doc.text('kg / ha', 235, fHeadY);
      doc.text('Farm Total', 300, fHeadY);
      doc.text('Bags', 385, fHeadY);
      doc.text('Est. Cost (INR)', 455, fHeadY);
      doc.moveTo(48, fHeadY + 13).lineTo(547, fHeadY + 13).strokeColor(border).stroke();

      let fy = fHeadY + 18;
      doc.font('Helvetica').fontSize(9).fillColor(ink);
      for (const item of rec.lineItems) {
        doc.text(`${item.productName} (${item.gradeLabel})`, 48, fy, { width: 180 });
        doc.text(`${item.quantityPerHectareKg} kg`, 235, fy);
        doc.text(`${item.totalQuantityKg} kg`, 300, fy);
        doc.text(`${item.totalBags} x ${item.bagWeightKg}kg`, 385, fy);
        doc.text(`Rs. ${item.estimatedPriceInr.toLocaleString('en-IN')}`, 455, fy);
        fy += 17;
      }

      doc.moveTo(48, fy + 2).lineTo(547, fy + 2).strokeColor(border).stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(forest)
        .text(`Total Estimated Fertilizer Cost (${rec.landAreaDisplay}): Rs. ${rec.totalEstimatedCostInr.toLocaleString('en-IN')}`, 48, fy + 10);

      // Split Schedule
      doc.y = fy + 34;
      if (doc.y > 670) doc.addPage();
      doc.fontSize(11).font('Helvetica-Bold').fillColor(forest).text('Application Split Schedule');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor(ink);
      for (const stage of rec.applicationSchedule) {
        const prodList = stage.products.map((p) => `${p.productName}: ${p.totalKg} kg`).join(', ');
        doc.font('Helvetica-Bold').text(`${stage.stage} (${stage.timing})`);
        doc.font('Helvetica').fillColor(muted).text(`${stage.instructions}${prodList ? ` — Apply: ${prodList}` : ''}`, { width: 500 });
        doc.fillColor(ink).moveDown(0.35);
      }

      // Assumptions & Warnings
      if (doc.y > 660) doc.addPage();
      doc.moveDown(0.4);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(forest).text('4. Assumptions, Warnings & Authoritative Sources');
      doc.moveTo(48, doc.y + 3).lineTo(547, doc.y + 3).strokeColor(border).stroke();
      doc.moveDown(0.4);
      doc.fontSize(8.5).font('Helvetica').fillColor(ink);
      for (const a of rec.assumptions) {
        doc.text(`• ${a}`, { width: 500 });
      }
      if (rec.warnings.length > 0) {
        doc.moveDown(0.3).font('Helvetica-Bold').fillColor('#B45309').text('Field Precautions:');
        doc.font('Helvetica').fillColor(ink);
        for (const w of rec.warnings) {
          doc.text(`• ${w}`, { width: 500 });
        }
      }
      doc.moveDown(0.3).font('Helvetica-Bold').fillColor(forest).text('Verified References:');
      doc.font('Helvetica').fillColor(muted);
      for (const ref of rec.sourceReferences) {
        doc.text(`• ${ref}`, { width: 500 });
      }
    }

    doc.end();
  });
}
