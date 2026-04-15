-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('email', 'google', 'github');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'live', 'closed');

-- CreateEnum
CREATE TYPE "SurveyTheme" AS ENUM ('default', 'minimal', 'bold', 'dark', 'pastel');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'rating', 'yes_no', 'dropdown', 'date', 'welcome_screen', 'thank_you_screen');

-- CreateEnum
CREATE TYPE "ValidationRule" AS ENUM ('none', 'email', 'url', 'number');

-- CreateEnum
CREATE TYPE "RatingStyle" AS ENUM ('stars', 'numeric', 'emoji');

-- CreateEnum
CREATE TYPE "LogicRuleType" AS ENUM ('skip_to', 'show_if', 'hide_if');

-- CreateEnum
CREATE TYPE "ResponseStatus" AS ENUM ('partial', 'complete');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('nps', 'csat', 'event_feedback', 'product_feedback', 'employee_pulse');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "authProvider" "AuthProvider" NOT NULL,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'draft',
    "theme" "SurveyTheme" NOT NULL DEFAULT 'default',
    "responseLimit" INTEGER,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "duplicatePrevention" BOOLEAN NOT NULL DEFAULT false,
    "anonymousResponses" BOOLEAN NOT NULL DEFAULT true,
    "requireEmail" BOOLEAN NOT NULL DEFAULT false,
    "thankYouMessage" TEXT,
    "redirectUrl" TEXT,
    "redirectDelay" INTEGER NOT NULL DEFAULT 5,
    "openAt" TIMESTAMP(3),
    "closeAt" TIMESTAMP(3),
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "placeholder" TEXT,
    "validation" "ValidationRule" DEFAULT 'none',
    "charLimit" INTEGER,
    "minSelections" INTEGER,
    "maxSelections" INTEGER,
    "ratingStyle" "RatingStyle",
    "ratingMax" INTEGER DEFAULT 5,
    "searchable" BOOLEAN NOT NULL DEFAULT false,
    "minDate" TIMESTAMP(3),
    "maxDate" TIMESTAMP(3),
    "allowOther" BOOLEAN NOT NULL DEFAULT false,
    "buttonLabel" TEXT,
    "ctaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logic_rules" (
    "id" TEXT NOT NULL,
    "type" "LogicRuleType" NOT NULL,
    "conditionValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surveyId" TEXT NOT NULL,
    "sourceQuestionId" TEXT NOT NULL,
    "targetQuestionId" TEXT NOT NULL,

    CONSTRAINT "logic_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "status" "ResponseStatus" NOT NULL DEFAULT 'partial',
    "respondentEmail" TEXT,
    "browserFingerprint" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastQuestionIndex" INTEGER NOT NULL DEFAULT 0,
    "completionTimeSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "value" TEXT,
    "selectedOptions" JSONB,
    "numericValue" DOUBLE PRECISION,
    "dateValue" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "TemplateCategory" NOT NULL,
    "questionsJson" JSONB NOT NULL,
    "previewImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "surveys_slug_key" ON "surveys"("slug");

-- CreateIndex
CREATE INDEX "surveys_userId_idx" ON "surveys"("userId");

-- CreateIndex
CREATE INDEX "surveys_slug_idx" ON "surveys"("slug");

-- CreateIndex
CREATE INDEX "surveys_status_idx" ON "surveys"("status");

-- CreateIndex
CREATE INDEX "questions_surveyId_order_idx" ON "questions"("surveyId", "order");

-- CreateIndex
CREATE INDEX "question_options_questionId_order_idx" ON "question_options"("questionId", "order");

-- CreateIndex
CREATE INDEX "logic_rules_surveyId_idx" ON "logic_rules"("surveyId");

-- CreateIndex
CREATE INDEX "logic_rules_sourceQuestionId_idx" ON "logic_rules"("sourceQuestionId");

-- CreateIndex
CREATE INDEX "responses_surveyId_idx" ON "responses"("surveyId");

-- CreateIndex
CREATE INDEX "responses_surveyId_browserFingerprint_idx" ON "responses"("surveyId", "browserFingerprint");

-- CreateIndex
CREATE INDEX "responses_status_idx" ON "responses"("status");

-- CreateIndex
CREATE INDEX "answers_responseId_idx" ON "answers"("responseId");

-- CreateIndex
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logic_rules" ADD CONSTRAINT "logic_rules_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logic_rules" ADD CONSTRAINT "logic_rules_sourceQuestionId_fkey" FOREIGN KEY ("sourceQuestionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logic_rules" ADD CONSTRAINT "logic_rules_targetQuestionId_fkey" FOREIGN KEY ("targetQuestionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
