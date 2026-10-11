# EnterpriseX Project Status Checker
# Read-only: this script does not modify source code or the database.

$ErrorActionPreference = "Continue"

$ProjectRoot = "C:\Dev\EnterpriseX"
Set-Location $ProjectRoot

function Write-Section([string]$Title) {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor DarkGray
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "====================================================" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "          ENTERPRISEX PROJECT STATUS" -ForegroundColor Cyan
Write-Host "          Checked: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "          Project: $ProjectRoot"

# 1. Git status
Write-Section "1. SOURCE CONTROL"

$Branch = git branch --show-current
$Commit = git log -1 --format="%h - %s"
$GitChanges = git status --porcelain

Write-Host "Branch: $Branch"
Write-Host "Latest commit: $Commit"

if ($GitChanges) {
    Write-Host "Working tree: CHANGES DETECTED" -ForegroundColor Yellow
    git status --short
}
else {
    Write-Host "Working tree: CLEAN" -ForegroundColor Green
}

# 2. Database and migrations
Write-Section "2. DATABASE MIGRATIONS"

$MigrationFiles = @(
    Get-ChildItem "$ProjectRoot\database\migrations" -File -Filter "*.sql" |
    Sort-Object Name
)

$FileVersions = @(
    $MigrationFiles | ForEach-Object {
        [regex]::Match($_.BaseName, '^\d+').Value
    }
)

Write-Host "Migration files found: $($MigrationFiles.Count)"
Write-Host "Latest migration file: $($MigrationFiles[-1].Name)"

$ContainerRunning = $false

try {
    $ContainerState = docker inspect --format '{{.State.Running}}' enterprisex-postgres 2>$null
    $ContainerRunning = ($LASTEXITCODE -eq 0 -and $ContainerState -eq "true")
}
catch {
    $ContainerRunning = $false
}

$AppliedVersions = @()

if ($ContainerRunning) {
    Write-Host "PostgreSQL container: RUNNING" -ForegroundColor Green

    $MigrationQuery = @"
SELECT version
FROM core.schema_migrations
ORDER BY version;
"@

    $DbOutput = @(
        docker exec -i enterprisex-postgres psql `
            -U enterprisex -d enterprisex -At -c $MigrationQuery 2>$null
    )

    if ($LASTEXITCODE -eq 0) {
        $AppliedVersions = @(
            $DbOutput |
            ForEach-Object { "$_".Trim() } |
            Where-Object { $_ -match '^\d+$' }
        )

        Write-Host "Migrations recorded as applied: $($AppliedVersions.Count)"

        $PendingMigrations = @(
            $MigrationFiles | Where-Object {
                $Version = [regex]::Match($_.BaseName, '^\d+').Value
                $Version -notin $AppliedVersions
            }
        )

        if ($PendingMigrations.Count -eq 0) {
            Write-Host "Migration status: ALL FILES APPLIED" -ForegroundColor Green
        }
        else {
            Write-Host "Migration status: PENDING FILES" -ForegroundColor Yellow
            foreach ($Migration in $PendingMigrations) {
                Write-Host "  PENDING: $($Migration.Name)" -ForegroundColor Yellow
            }
        }
    }
    else {
        Write-Host "Could not query the migration tracking table." -ForegroundColor Yellow
    }
}
else {
    Write-Host "PostgreSQL container: NOT RUNNING OR NOT FOUND" -ForegroundColor Yellow
    Write-Host "Database migration status could not be verified."
}

# 3. Current master-data step
Write-Section "3. CURRENT DEVELOPMENT STEP"

$Migration015 = "$ProjectRoot\database\migrations\015_create_core_master_data.sql"
$Version015Applied = "015" -in $AppliedVersions

if ($Version015Applied) {
    Write-Host "Migration 015: APPLIED" -ForegroundColor Green
    Write-Host "Next: implement and test the Core Master Data API."
}
elseif (Test-Path $Migration015) {
    Write-Host "Migration 015: FILE EXISTS, NOT CONFIRMED APPLIED" -ForegroundColor Yellow
    Write-Host "Next: review the migration and apply it using the project migration runner."
}
else {
    Write-Host "Migration 015: NOT CREATED" -ForegroundColor Yellow
    Write-Host "Next: design and create the Core Master Data migration."
}

# 4. Project structure
Write-Section "4. MODULE STRUCTURE"

$PathsToCheck = @(
    "apps\api\src\modules\security-identity",
    "apps\api\src\modules\core-platform",
    "apps\desktop\src\api",
    "apps\desktop\src\auth",
    "apps\desktop\src\screens",
    "database\migrations"
)

foreach ($RelativePath in $PathsToCheck) {
    $FullPath = Join-Path $ProjectRoot $RelativePath

    if (Test-Path $FullPath) {
        Write-Host "[FOUND]  $RelativePath" -ForegroundColor Green
    }
    else {
        Write-Host "[MISSING] $RelativePath" -ForegroundColor Yellow
    }
}

# 5. Available commands
Write-Section "5. AVAILABLE BUILD AND TEST COMMANDS"

$ApiPackagePath = "$ProjectRoot\apps\api\package.json"
$DesktopPackagePath = "$ProjectRoot\apps\desktop\package.json"

foreach ($PackagePath in @($ApiPackagePath, $DesktopPackagePath)) {
    if (Test-Path $PackagePath) {
        $Package = Get-Content $PackagePath -Raw | ConvertFrom-Json
        Write-Host ""
        Write-Host "Workspace: $($Package.name)" -ForegroundColor Cyan

        foreach ($ScriptName in @("build", "test", "dev")) {
            $Property = $Package.scripts.PSObject.Properties[$ScriptName]
            if ($null -ne $Property) {
                Write-Host "  $ScriptName : $($Property.Value)"
            }
        }
    }
}

# 6. Summary
Write-Section "6. NEXT ACTION"

if (-not $ContainerRunning) {
    Write-Host "Start/check the existing PostgreSQL container, then rerun this report." -ForegroundColor Yellow
}
elseif ($null -ne $PendingMigrations -and $PendingMigrations.Count -gt 0) {
    Write-Host "Resolve pending database migrations before implementing the next layer." -ForegroundColor Yellow
}
elseif (-not $Version015Applied) {
    Write-Host "Continue with Core Master Data migration 015." -ForegroundColor Yellow
}
else {
    Write-Host "Continue with Core Master Data API, authorization, and tests." -ForegroundColor Green
}

Write-Host ""
Write-Host "NOTE: This report checks current files, Git, and migration tracking."
Write-Host "It does not run the build or tests and does not prove that code is production-ready."
Write-Host ""
