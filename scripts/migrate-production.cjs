const { spawnSync } = require("node:child_process");

function present(name) {
  const value = process.env[name];
  return Boolean(value && value !== "[SENSITIVE]" && value.length > 8);
}

function hostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function redact(text) {
  return String(text).replace(/(postgres(?:ql)?:\/\/)[^\s]+/gi, "$1[redacted]");
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", env: process.env });
  if (result.stdout) process.stdout.write(redact(result.stdout));
  if (result.stderr) process.stderr.write(redact(result.stderr));
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function main() {
  const onVercelProduction = process.env.VERCEL_ENV === "production";
  if (!present("DATABASE_URL")) {
    if (onVercelProduction) {
      console.error("DATABASE_URL is required for production migrations.");
      process.exit(1);
    }
    console.log("Skipping Prisma migrate: DATABASE_URL is not set.");
    return;
  }

  const unpooled = present("DATABASE_URL_UNPOOLED")
    ? process.env.DATABASE_URL_UNPOOLED
    : present("DATABASE_POSTGRES_URL_NON_POOLING")
      ? process.env.DATABASE_POSTGRES_URL_NON_POOLING
      : "";
  if (unpooled) process.env.DATABASE_URL = unpooled;

  if (
    process.env.VERCEL_PROJECT_ID &&
    process.env.VERCEL_PROJECT_ID !== "prj_k6atJPZzwKiAgAP7Lq9MzM3lnDgQ"
  ) {
    console.error("Refusing to migrate: not the BizPilot AI Vercel project.");
    process.exit(1);
  }
  if (process.env.VERCEL_GIT_REPO_SLUG && process.env.VERCEL_GIT_REPO_SLUG !== "bizpilot-ai") {
    console.error("Refusing to migrate: unexpected git repository.");
    process.exit(1);
  }

  const host = hostname(process.env.DATABASE_URL);
  if (!/neon/i.test(host)) {
    console.error("Refusing to migrate: database host is not Neon.");
    process.exit(1);
  }

  console.log("DATABASE_URL: present");
  console.log("using_unpooled_for_migrate: " + Boolean(unpooled));
  console.log("host_is_neon: true");

  run("npx", ["prisma", "generate", "--schema=prisma/schema.prisma"]);
  run("npx", ["prisma", "migrate", "deploy"]);

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`,
    );
    const indexes = await prisma.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname`,
    );
    const fks = await prisma.$queryRawUnsafe(
      `SELECT constraint_name FROM information_schema.table_constraints
       WHERE constraint_type = 'FOREIGN KEY' AND table_schema = 'public'
       ORDER BY constraint_name`,
    );
    const tenantCols = await prisma.$queryRawUnsafe(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name IN ('workspaceId', 'userId', 'widgetKey', 'ownerUserId')
       ORDER BY table_name, column_name`,
    );
    const applied = await prisma.$queryRawUnsafe(
      `SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY finished_at`,
    );
    console.log("MIGRATION_APPLIED " + applied.map((row) => row.migration_name).join(","));
    console.log("MIGRATION_TABLES " + tables.map((row) => row.tablename).join(","));
    console.log("MIGRATION_INDEX_COUNT " + indexes.length);
    console.log("MIGRATION_FK_COUNT " + fks.length);
    console.log(
      "MIGRATION_TENANT_FIELDS " +
        tenantCols.map((row) => `${row.table_name}.${row.column_name}`).join(","),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(redact(error && error.message ? error.message : error));
  process.exit(1);
});
