--
-- PostgreSQL database dump
--

\restrict NdwJx9BBKMxnvPSJNXZe6FX8mdPN2k8RyZc4KYledcduo9bA0dX1zkkUagVS67B

-- Dumped from database version 18.4 (Ubuntu 18.4-1.pgdg24.04+1)
-- Dumped by pg_dump version 18.4 (Ubuntu 18.4-1.pgdg24.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgtle; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA pgtle;


ALTER SCHEMA pgtle OWNER TO postgres;

--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: server; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.server AS (
	ip integer,
	port smallint,
	lastseen bigint
);


ALTER TYPE public.server OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bedrock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bedrock (
    serverid bigint NOT NULL,
    ip integer,
    port smallint,
    discovered bigint,
    lastseen bigint,
    education boolean,
    version text,
    protocol integer,
    description text,
    rawdescription text,
    description2 text,
    rawdescription2 text,
    playercount integer,
    playerlimit integer,
    gamemode text,
    modeid integer,
    org text,
    country text,
    city text,
    lat real,
    lon real
);


ALTER TABLE public.bedrock OWNER TO postgres;

--
-- Name: bedrock_serverid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.bedrock_serverid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bedrock_serverid_seq OWNER TO postgres;

--
-- Name: bedrock_serverid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.bedrock_serverid_seq OWNED BY public.bedrock.serverid;


--
-- Name: playerhistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.playerhistory (
    name text,
    id text,
    serverid bigint,
    lastsession bigint
);


ALTER TABLE public.playerhistory OWNER TO postgres;

--
-- Name: servers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.servers (
    serverid bigint NOT NULL,
    ip integer,
    port smallint,
    discovered bigint,
    lastseen bigint,
    version text,
    protocol integer,
    description text,
    rawdescription text,
    playercount integer,
    playerlimit integer,
    hasfavicon boolean,
    hasforgedata boolean,
    enforcessecurechat boolean,
    org text,
    country text,
    city text,
    lat real,
    lon real,
    cracked boolean,
    whitelisted boolean,
    hasplayersample boolean,
    descriptionvector tsvector
);


ALTER TABLE public.servers OWNER TO postgres;

--
-- Name: servers_serverid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.servers_serverid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.servers_serverid_seq OWNER TO postgres;

--
-- Name: servers_serverid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.servers_serverid_seq OWNED BY public.servers.serverid;


--
-- Name: bedrock serverid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bedrock ALTER COLUMN serverid SET DEFAULT nextval('public.bedrock_serverid_seq'::regclass);


--
-- Name: servers serverid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers ALTER COLUMN serverid SET DEFAULT nextval('public.servers_serverid_seq'::regclass);


--
-- Name: bedrock bedrock_ip_port_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bedrock
    ADD CONSTRAINT bedrock_ip_port_key UNIQUE (ip, port);


--
-- Name: bedrock bedrock_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bedrock
    ADD CONSTRAINT bedrock_pkey1 PRIMARY KEY (serverid);


--
-- Name: playerhistory players_name_id_serverid_constraint; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.playerhistory
    ADD CONSTRAINT players_name_id_serverid_constraint UNIQUE (name, id, serverid);


--
-- Name: servers servers_ip_port_key1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_ip_port_key1 UNIQUE (ip, port);


--
-- Name: servers servers_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers
    ADD CONSTRAINT servers_pkey1 PRIMARY KEY (serverid);


--
-- Name: bedrock_discovered; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_discovered ON public.bedrock USING btree (discovered);


--
-- Name: bedrock_ip; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_ip ON public.bedrock USING btree (ip);


--
-- Name: bedrock_lastseen_desc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_lastseen_desc ON public.bedrock USING btree (lastseen DESC);


--
-- Name: bedrock_modeid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_modeid ON public.bedrock USING btree (modeid);


--
-- Name: bedrock_playercount; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_playercount ON public.bedrock USING btree (playercount);


--
-- Name: bedrock_playerlimit; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_playerlimit ON public.bedrock USING btree (playerlimit);


--
-- Name: bedrock_port; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_port ON public.bedrock USING btree (port);


--
-- Name: bedrock_protocol; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX bedrock_protocol ON public.bedrock USING btree (protocol);


--
-- Name: country_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX country_index ON public.servers USING btree (country);


--
-- Name: cracked_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cracked_active_index ON public.servers USING btree (cracked) WHERE (cracked IS NOT NULL);


--
-- Name: description_trgm_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX description_trgm_index ON public.servers USING gin (description public.gin_trgm_ops);


--
-- Name: descriptionvector_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX descriptionvector_index ON public.servers USING gin (descriptionvector);


--
-- Name: discovered_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX discovered_index ON public.servers USING btree (discovered);


--
-- Name: ip_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ip_index ON public.servers USING btree (ip);


--
-- Name: lastseen_desc_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lastseen_desc_index ON public.servers USING btree (lastseen DESC);


--
-- Name: org_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX org_index ON public.servers USING btree (org);


--
-- Name: playercount_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX playercount_index ON public.servers USING btree (playercount);


--
-- Name: playerlimit_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX playerlimit_index ON public.servers USING btree (playerlimit);


--
-- Name: players_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX players_id ON public.playerhistory USING btree (id);


--
-- Name: players_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX players_name ON public.playerhistory USING btree (name);


--
-- Name: players_serverid; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX players_serverid ON public.playerhistory USING btree (serverid);


--
-- Name: port_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX port_index ON public.servers USING btree (port);


--
-- Name: protocol_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX protocol_index ON public.servers USING btree (protocol);


--
-- Name: version_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX version_index ON public.servers USING btree (version);


--
-- Name: version_trgm_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX version_trgm_index ON public.servers USING gin (version public.gin_trgm_ops);


--
-- Name: whitelisted_active_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX whitelisted_active_index ON public.servers USING btree (whitelisted) WHERE (whitelisted IS NOT NULL);


--
-- PostgreSQL database dump complete
--

\unrestrict NdwJx9BBKMxnvPSJNXZe6FX8mdPN2k8RyZc4KYledcduo9bA0dX1zkkUagVS67B

