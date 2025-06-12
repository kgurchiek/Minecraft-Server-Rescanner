--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
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
-- Name: history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.history (
    serverid bigint NOT NULL,
    playerid bigint NOT NULL,
    lastsession bigint
);


ALTER TABLE public.history OWNER TO postgres;

--
-- Name: players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players (
    playerid bigint NOT NULL,
    name text,
    id text
);


ALTER TABLE public.players OWNER TO postgres;

--
-- Name: players_playerid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.players_playerid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.players_playerid_seq OWNER TO postgres;

--
-- Name: players_playerid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.players_playerid_seq OWNED BY public.players.playerid;


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
    AS integer
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
-- Name: players playerid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players ALTER COLUMN playerid SET DEFAULT nextval('public.players_playerid_seq'::regclass);


--
-- Name: servers serverid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.servers ALTER COLUMN serverid SET DEFAULT nextval('public.servers_serverid_seq'::regclass);


--
-- Name: history history_serverid_playerid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.history
    ADD CONSTRAINT history_serverid_playerid_key UNIQUE (serverid, playerid);


--
-- Name: players players_name_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_name_id_key UNIQUE (name, id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (playerid);


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
-- Name: descriptionvector_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX descriptionvector_index ON public.servers USING gin (descriptionvector);


--
-- Name: discovered_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX discovered_index ON public.servers USING btree (discovered);


--
-- Name: history_playerid_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX history_playerid_index ON public.history USING btree (playerid);


--
-- Name: history_serverid_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX history_serverid_index ON public.history USING btree (serverid);


--
-- Name: history_serverid_playerid_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX history_serverid_playerid_index ON public.history USING btree (serverid, playerid);


--
-- Name: id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX id_index ON public.players USING btree (id);


--
-- Name: ip_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ip_index ON public.servers USING btree (ip);


--
-- Name: lastseen_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lastseen_index ON public.servers USING btree (lastseen);


--
-- Name: lastsession_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lastsession_index ON public.history USING btree (lastsession);


--
-- Name: lat_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lat_index ON public.servers USING btree (lat);


--
-- Name: lon_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX lon_index ON public.servers USING btree (lon);


--
-- Name: name_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX name_index ON public.players USING btree (name);


--
-- Name: playercount_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX playercount_index ON public.servers USING btree (playercount);


--
-- Name: playerid_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX playerid_index ON public.players USING btree (playerid);


--
-- Name: playerlimit_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX playerlimit_index ON public.servers USING btree (playerlimit);


--
-- Name: players_playerid_name_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX players_playerid_name_index ON public.players USING btree (playerid, name);


--
-- Name: port_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX port_index ON public.servers USING btree (port);


--
-- Name: protocol_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX protocol_index ON public.servers USING btree (protocol);


--
-- Name: serverid_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX serverid_index ON public.servers USING btree (serverid);


--
-- Name: history history_playerid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.history
    ADD CONSTRAINT history_playerid_fkey FOREIGN KEY (playerid) REFERENCES public.players(playerid) ON DELETE CASCADE;


--
-- Name: history history_serverid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.history
    ADD CONSTRAINT history_serverid_fkey FOREIGN KEY (serverid) REFERENCES public.servers(serverid) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

