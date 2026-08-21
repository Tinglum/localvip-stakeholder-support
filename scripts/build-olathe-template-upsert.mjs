/**
 * Build an idempotent SQL Server import for the nine Olathe production flyers.
 *
 * The SVGs and preview PNGs are served by the self-hosted dashboard. The QA
 * backend stores their URLs and the QR/account metadata, then generates a
 * campaign-specific copy when an authorised Olathe user selects a QR code.
 *
 * Usage:
 *   node scripts/build-olathe-template-upsert.mjs > tmp/upsert-olathe-templates.sql
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('public/templates/olathe')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'olathe-template-manifest.json'), 'utf8'))

const sql = (value) => `N'${String(value).replaceAll("'", "''")}'`
const nullableCsv = (values) => values?.length ? sql(values.join(',')) : 'NULL'

const rows = manifest.map((item) => {
  const previewPath = `/templates/olathe/production-previews/${item.key}.png`
  return `(${[
    sql(item.key),
    sql(item.title),
    sql(item.description),
    sql(item.type),
    sql(item.brand),
    sql(item.publicPath),
    sql(previewPath),
    sql(item.fileName),
    sql(item.mimeType),
    sql(item.category),
    sql(item.useCase),
    nullableCsv(item.targetRoles),
    nullableCsv(item.targetSubtypes),
    sql(JSON.stringify(item.metadata)),
  ].join(', ')})`
}).join(',\n')

const assignments = manifest.flatMap((item) =>
  item.causeAccountIds.map((causeId) => `
INSERT INTO MaterialAssignments (MaterialId, EntityType, EntityId, Notes, CreatedAt)
SELECT m.Id, N'cause', ${Number(causeId)}, N'Olathe production template assignment', SYSUTCDATETIME()
FROM DashboardMaterials m
WHERE ISJSON(m.Metadata) = 1 AND JSON_VALUE(m.Metadata, '$.template_key') = ${sql(item.key)}
  AND NOT EXISTS (
    SELECT 1 FROM MaterialAssignments a
    WHERE a.MaterialId = m.Id AND a.EntityType = N'cause' AND a.EntityId = ${Number(causeId)}
  );`),
).join('\n')

const output = `SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @BaseUrl nvarchar(256) = N'https://dashboard.localvip.com';

DECLARE @Source TABLE (
  TemplateKey nvarchar(128) NOT NULL,
  Title nvarchar(256) NOT NULL,
  Description nvarchar(max) NULL,
  Type nvarchar(64) NOT NULL,
  Brand nvarchar(32) NOT NULL,
  PublicPath nvarchar(512) NOT NULL,
  PreviewPath nvarchar(512) NOT NULL,
  FileName nvarchar(256) NOT NULL,
  MimeType nvarchar(128) NOT NULL,
  Category nvarchar(128) NULL,
  UseCase nvarchar(256) NULL,
  TargetRoles nvarchar(512) NULL,
  TargetSubtypes nvarchar(256) NULL,
  Metadata nvarchar(max) NOT NULL
);

INSERT INTO @Source (
  TemplateKey, Title, Description, Type, Brand, PublicPath, PreviewPath,
  FileName, MimeType, Category, UseCase, TargetRoles, TargetSubtypes, Metadata
)
VALUES
${rows};

MERGE DashboardMaterials AS target
USING @Source AS source
ON CASE WHEN ISJSON(target.Metadata) = 1 THEN JSON_VALUE(target.Metadata, '$.template_key') END = source.TemplateKey
WHEN MATCHED THEN UPDATE SET
  target.Title = source.Title,
  target.Description = source.Description,
  target.Type = source.Type,
  target.Brand = source.Brand,
  target.FileUrl = @BaseUrl + source.PublicPath,
  target.FileName = source.FileName,
  target.FileSize = NULL,
  target.MimeType = source.MimeType,
  target.ThumbnailUrl = @BaseUrl + source.PreviewPath,
  target.Category = source.Category,
  target.UseCase = source.UseCase,
  target.TargetRoles = source.TargetRoles,
  target.TargetSubtypes = source.TargetSubtypes,
  target.IsTemplate = 1,
  target.Version = CASE
    WHEN ISNULL(target.FileUrl, N'') <> @BaseUrl + source.PublicPath OR ISNULL(target.Metadata, N'') <> source.Metadata
    THEN target.Version + 1 ELSE target.Version END,
  target.Status = N'active',
  target.Metadata = source.Metadata,
  target.UpdatedAt = SYSUTCDATETIME()
WHEN NOT MATCHED THEN INSERT (
  Title, Description, Type, Brand, FileUrl, FileName, FileSize, MimeType,
  ThumbnailUrl, Category, UseCase, TargetRoles, TargetSubtypes, IsTemplate,
  Version, Status, Metadata, CreatedAt, UpdatedAt
) VALUES (
  source.Title, source.Description, source.Type, source.Brand,
  @BaseUrl + source.PublicPath, source.FileName, NULL, source.MimeType,
  @BaseUrl + source.PreviewPath, source.Category, source.UseCase,
  source.TargetRoles, source.TargetSubtypes, 1, 1, N'active', source.Metadata,
  SYSUTCDATETIME(), SYSUTCDATETIME()
);

${assignments}

-- Olathe's account users also need active Enabler assignments so the generic
-- Materials surface can verify their cause scope before listing or generating.
MERGE DashboardStakeholderAssignments AS target
USING (VALUES
  (CAST(190071 AS bigint), N'cause', CAST(190045 AS bigint), N'school_leader'),
  (CAST(190072 AS bigint), N'cause', CAST(190046 AS bigint), N'school_leader')
) AS source (StakeholderUserId, EntityType, EntityId, Role)
ON target.StakeholderUserId = source.StakeholderUserId
  AND target.EntityType = source.EntityType
  AND target.EntityId = source.EntityId
  AND target.Status = N'active'
WHEN NOT MATCHED THEN INSERT (
  StakeholderUserId, EntityType, EntityId, Role, OwnershipStatus, Status,
  Metadata, CreatedAt, UpdatedAt
) VALUES (
  source.StakeholderUserId, source.EntityType, source.EntityId, source.Role,
  N'claimed', N'active', N'{"source":"olathe-template-import"}',
  SYSUTCDATETIME(), SYSUTCDATETIME()
);

COMMIT TRANSACTION;

SELECT Id, Title, FileName, IsTemplate, Version, Status,
  JSON_VALUE(Metadata, '$.template_key') AS TemplateKey
FROM DashboardMaterials
WHERE ISJSON(Metadata) = 1 AND JSON_VALUE(Metadata, '$.collection') = N'olathe-community-giveback'
ORDER BY Title;

SELECT MaterialId, EntityType, EntityId, Notes
FROM MaterialAssignments
WHERE MaterialId IN (
  SELECT Id FROM DashboardMaterials
  WHERE ISJSON(Metadata) = 1 AND JSON_VALUE(Metadata, '$.collection') = N'olathe-community-giveback'
)
ORDER BY MaterialId, EntityId;
`

const outputFlag = process.argv.indexOf('--out')
if (outputFlag >= 0) {
  const outputPath = process.argv[outputFlag + 1]
  if (!outputPath) throw new Error('--out requires a file path')
  fs.writeFileSync(path.resolve(outputPath), output)
  console.log(`Wrote ${outputPath}`)
} else {
  process.stdout.write(output)
}
